"""Conversion orchestration.

The pipeline is the same for every platform pair:

    source text -> source parser -> normalized model -> target renderer
                -> validation -> conversion report

There is no hard-coded pair list. A pair is "unsupported" only when the
*content* cannot be translated, never because a mapping table has no entry.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.converters import get_converter
from app.models.conversion import (
    ConversionIssue,
    ConversionResult,
    LineMapping,
    ValidationStage,
)
from app.models.device import PLATFORM_METADATA, PlatformId, resolve_platform
from app.models.network import NetworkConfig
from app.services.detector import detect_platform
from app.services.validator import overall_status, validate_rendered

#: Hard cap on how much text we will parse, to keep one request bounded.
MAX_CONFIGURATION_CHARS = 2_000_000


class ConversionError(Exception):
    """Raised for caller-correctable problems (unknown platform, empty input)."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _source_mismatch_detail(configuration: str, source_platform: PlatformId) -> str | None:
    """Name the mismatch when the selected parser understood *nothing*.

    The operator's platform selection stays the source of truth: detection is
    consulted only after the selected parser has failed completely, and a
    finding is only reported when the detected syntax belongs to a different
    CLI family. Within one family (Cisco IOS vs IOS XE, say) the selection may
    still be right, so the generic "no recognised statements" error stands.
    """
    try:
        detection = detect_platform(configuration)
    except Exception:  # pragma: no cover - detection must never mask the 422
        return None
    detected_value = detection.get("platform")
    if not detected_value:
        return None
    detected = resolve_platform(str(detected_value))
    if detected is None or detected == source_platform:
        return None
    if PLATFORM_METADATA[detected].family == PLATFORM_METADATA[source_platform].family:
        return None
    detected_name = PLATFORM_METADATA[detected].name
    selected_name = PLATFORM_METADATA[source_platform].name
    return (
        f"Configuration appears to use {detected_name} syntax, but {selected_name} "
        f"was selected as the source platform. Set the source platform to "
        f"{detected_name} - or supply a {selected_name} configuration - and run "
        "the conversion again."
    )


def convert(
    source_platform: PlatformId,
    target_platform: PlatformId,
    configuration: str,
    *,
    run_validation: bool = True,
) -> ConversionResult:
    """Run a full conversion and return the structured result."""
    if configuration is None or not configuration.strip():
        raise ConversionError("Configuration is empty. Paste a configuration or upload a file.")

    if len(configuration) > MAX_CONFIGURATION_CHARS:
        raise ConversionError(
            f"Configuration exceeds the {MAX_CONFIGURATION_CHARS:,} character limit."
        )

    source_converter = get_converter(source_platform)
    target_converter = get_converter(target_platform)

    # ---- 1. Parse into the normalized model ---------------------------------
    parse_result = source_converter.parse(configuration)
    model: NetworkConfig = parse_result.config

    if model.is_empty():
        # Nothing at all was understood. Say so rather than emitting an empty
        # configuration the operator might mistake for a successful conversion.
        # If the text plainly belongs to another CLI family, name it outright
        # instead of only hinting that the source platform may be wrong.
        detail = _source_mismatch_detail(configuration, source_platform) or (
            f"No recognised {source_platform.value} configuration statements were found. "
            "Check that the source platform is correct."
        )
        if model.unparsed:
            sample = "; ".join(entry.raw[:60] for entry in model.unparsed[:3])
            detail += f" Unrecognised lines included: {sample}."
        raise ConversionError(detail, status_code=422)

    # ---- 2. Render into the target syntax -----------------------------------
    # A VLAN referenced by an access/trunk port must exist on the target even
    # when the source platform never declared it.
    implied_vlans = model.ensure_referenced_vlans()
    render_result = target_converter.render(model)

    # ---- 3. Validate --------------------------------------------------------
    stages: list[ValidationStage] = []
    validity = "not_run"
    if run_validation:
        outcomes = validate_rendered(target_platform, render_result, model)
        stages = [
            ValidationStage(id=o.id, label=o.label, status=o.status, detail=o.detail)
            for o in outcomes
        ]
        validity = overall_status(outcomes)

    # ---- 4. Collect the not-translated evidence ----------------------------
    # `flagged` records, per source command, why it was not translated, so the
    # warnings and the line-by-line table can point at the exact statement.
    flagged: dict[str, tuple[str, str]] = {}

    converted = render_result.translated
    requires_review = len(render_result.needs_review())
    unsupported = len(render_result.unsupported()) + len(model.unparsed)

    # Status is derived from what actually happened - never from a pair table.
    if validity == "invalid":
        status = "invalid"
    elif converted == 0 and unsupported > 0:
        status = "unsupported"
    elif unsupported > 0:
        status = "partial"
    elif requires_review > 0 or validity == "valid_with_review":
        status = "requires_review"
    else:
        status = "success"

    warnings: list[ConversionIssue] = []
    # The standing caveat every conversion carries.
    warnings.append(
        ConversionIssue(
            id="standing-caveat",
            status="requires_review",
            concept="Vendor-specific behaviour",
            detail=(
                "Some vendor-specific commands may require manual review. The engine "
                "translates configuration intent, not vendor behaviour: security policy, "
                "credentials, SNMP communities and management-access models rarely survive "
                "a platform change unchanged."
            ),
        )
    )
    for issue in render_result.issues:
        # A renderer records *what* it cannot express; the service resolves that
        # back to the source command that asked for it, so the report quotes the
        # original text instead of an abstract limitation.
        source_commands: list[str] = []
        if issue.source_command:
            source_commands = [issue.source_command]
        else:
            source_commands = _original_commands_for(model, issue.concept)
        for command in source_commands:
            flagged.setdefault(command.strip(), (issue.status, issue.detail))
        if len(source_commands) > 1:
            joined = " | ".join(source_commands[:4])
            if len(source_commands) > 4:
                joined += f" (+{len(source_commands) - 4} more)"
            detail = f"{issue.detail} Source command(s): {joined}."
        elif source_commands:
            detail = f"{issue.detail} Source command: `{source_commands[0]}`."
        else:
            detail = issue.detail

        warnings.append(
            ConversionIssue(
                id=f"issue-{len(warnings)}",
                status=issue.status,
                concept=issue.concept,
                detail=detail,
                source_command=source_commands[0] if source_commands else None,
            )
        )
    for index, entry in enumerate(model.unparsed):
        warnings.append(
            ConversionIssue(
                id=f"unparsed-{index}",
                status="unsupported",
                concept="Unparsed statement",
                detail=f"Line {entry.line}: {entry.reason}",
                source_command=entry.raw,
                original_line=entry.raw,
            )
        )
    for index, partial in enumerate(model.partial):
        warnings.append(
            ConversionIssue(
                id=f"partial-{index}",
                status="requires_review",
                concept="Partially modelled statement",
                detail=(
                    "The source contained a recognised statement whose full behaviour is "
                    "not modelled, so it was not translated."
                ),
                source_command=partial,
            )
        )
    if implied_vlans:
        warnings.append(
            ConversionIssue(
                id="implied-vlans",
                status="requires_review",
                concept="VLAN definitions",
                detail=(
                    "VLAN "
                    + ", ".join(str(vlan_id) for vlan_id in implied_vlans)
                    + " was referenced by a port but never defined in the source. "
                    "It was created on the target without a name - assign one."
                ),
            )
        )

    # ---- 5. Assemble the line-by-line mapping table ------------------------
    mapping = _build_mapping(source_platform, configuration, model, render_result, stages, flagged)

    return ConversionResult(
        id=f"CONV-{uuid.uuid4().hex[:8].upper()}",
        source_platform=source_platform.value,
        target_platform=target_platform.value,
        status=status,
        converted_configuration=render_result.config,
        commands_processed=len(mapping) or (len(model.interfaces) + 1),
        commands_converted=converted,
        requires_review=requires_review + len(model.partial),
        unsupported=unsupported,
        warnings=warnings,
        validation=stages,
        mapping=mapping,
        ignored_lines=parse_result.ignored_lines,
        created_at=_now(),
    )


def _original_commands_for(model: NetworkConfig, concept: str) -> list[str]:
    """The source commands that produced a concept the target could not express.

    A renderer knows *what* it cannot express but not which line of the source
    asked for it. This maps the concept back to the original text so the report
    can quote it, rather than reporting an abstract limitation with no evidence.
    """
    lowered = concept.lower()

    if "access control" in lowered or "acl" in lowered or "firewall rule" in lowered:
        commands: list[str] = []
        for entry in model.acls:
            if entry.definition and entry.definition not in commands:
                commands.append(entry.definition)
        for entry in model.acls:
            command = entry.source_command or entry.raw
            if command and command not in commands:
                commands.append(command)
        return commands
    if "nat" in lowered:
        return [entry.raw for entry in model.nat if entry.raw]
    if "user" in lowered:
        return [entry.source_command or f"username {entry.name}" for entry in model.users]
    if "snmp" in lowered:
        return [entry.source_command or f"snmp-server community {entry.community}" for entry in model.snmp]
    if "ospf" in lowered or "bgp" in lowered or "dynamic routing" in lowered:
        commands: list[str] = []
        for process in model.ospf:
            commands.append(f"router ospf {process.process_id}")
        for process in model.bgp:
            commands.append(f"router bgp {process.asn}")
        return commands
    if "banner" in lowered or "motd" in lowered:
        return [f"banner motd {model.banner_motd}"] if model.banner_motd else []
    if "policy" in lowered:
        # PAN-OS-style: policy objects and dynamic routing share a concept label.
        return [entry.raw for entry in model.nat if entry.raw] + [
            entry.definition or entry.source_command or entry.raw
            for entry in model.acls
            if (entry.definition or entry.source_command or entry.raw)
        ]
    if "telnet" in lowered:
        return [model.telnet.source_command] if model.telnet and model.telnet.source_command else []
    if "domain" in lowered:
        return [f"ip domain-name {model.domain_name}"] if model.domain_name else []
    return []


def _build_mapping(
    source_platform: PlatformId,
    source_text: str,
    model: NetworkConfig,
    render_result,
    stages: list[ValidationStage],
    flagged: dict[str, tuple[str, str]],
) -> list[LineMapping]:
    """Line-by-line view combining what was understood with what was emitted.

    The source is re-read line by line so the operator can see, for each
    statement, whether it was translated, flagged, or left alone.
    """
    unparsed_by_text: dict[str, UnparsedCommand] = {
        entry.raw.strip(): entry for entry in model.unparsed
    }
    partials = {item.strip() for item in model.partial}

    # Map IR concepts back to the lines that produced them, so the table shows
    # the actual emitted target syntax rather than a placeholder.
    emitted: dict[str, list[str]] = {}
    for interface in model.interfaces:
        emitted.setdefault(f"interface {interface.name}", []).append(interface.name)
    if model.hostname:
        emitted.setdefault("hostname", []).append(model.hostname)
    if model.domain_name:
        emitted.setdefault("ip domain-name", []).append(model.domain_name)

    mapping: list[LineMapping] = []
    rows: list[tuple[int, str, bool]] = []  # (line number, text, is indented)
    for index, raw in enumerate(source_text.splitlines(), start=1):
        stripped = raw.strip()
        if not stripped or stripped[0] in "!#/*":
            continue
        if stripped in {"end", "exit", "return", "quit", "next"}:
            continue
        if stripped.lower() in {"configure", "commit"}:
            continue
        rows.append((index, stripped, raw[:1].isspace()))

    # A flagged sub-command implies its block header was not translated either:
    # `ip access-list extended MGMT` cannot have produced target syntax when its
    # entry did not. Walk back to the nearest non-indented line and inherit the
    # flag so the table never shows a block as "converted" falsely.
    inherited: dict[str, tuple[str, str]] = {}
    for position, (_line, text, indented) in enumerate(rows):
        if not indented:
            continue
        status_note = flagged.get(text) or (
            ("unsupported", f"Line {unparsed_by_text[text].line}: {unparsed_by_text[text].reason}")
            if text in unparsed_by_text
            else None
        )
        if status_note is None:
            continue
        for back in range(position - 1, -1, -1):
            if not rows[back][2]:
                header = rows[back][1]
                inherited.setdefault(header, status_note)
                break

    for index, stripped, _indented in rows:
        flag = flagged.get(stripped) or inherited.get(stripped)
        unparsed = unparsed_by_text.get(stripped)
        if flag or unparsed or stripped in partials:
            if unparsed is not None:
                status = "unsupported"
                note = f"Line {unparsed.line}: {unparsed.reason}"
            elif flag is not None:
                status, note = flag[0], flag[1]
            else:
                status = "requires_review"
                note = "Recognised, but only partially modelled."
            mapping.append(
                LineMapping(
                    line=index,
                    source=stripped,
                    target=[],
                    status=status,
                    rule_id="normalized",
                    rule_label="Source statement",
                    note=note,
                )
            )
            continue

        mapping.append(
            LineMapping(
                line=index,
                source=stripped,
                target=emitted.get(stripped, []),
                status="converted",
                rule_id="normalized",
                rule_label="Normalized model translation",
            )
        )
    del stages
    return mapping
