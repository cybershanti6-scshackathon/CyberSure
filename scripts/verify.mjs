// src/data/configSchema.ts
var ALL_TYPES = ["router", "switch", "firewall", "wireless-controller", "server"];
var NO_SERVER = ["router", "switch", "firewall", "wireless-controller"];
var on = (label, value = "Enabled") => ({ value, label });
var off = (label, value = "Disabled") => ({ value, label });
var CONFIG_SCHEMA = [
  /* ------------------------------------------------------------------ */
  /* Management Access                                                    */
  /* ------------------------------------------------------------------ */
  {
    id: "mgmt.ssh",
    category: "Management Access",
    setting: "SSH",
    label: "SSH Administrative Access",
    description: "Encrypted remote administration channel (SSHv2).",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Enabled",
    severity: "high",
    complianceRefs: [
      { framework: "cis", control: "CIS-4.2", label: "SSH enabled for remote administration" },
      { framework: "nist", control: "NIST CM-7", label: "Least-functionality remote access" }
    ],
    finding: {
      title: "SSH administrative access disabled",
      issueCategory: "Access Control",
      why: "Without SSH the only remaining remote administration paths are unencrypted, which exposes credentials in clear text.",
      fix: "Re-enable SSHv2 and bind it to the management interface only.",
      reference: "CS-BASELINE-MGMT-01"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "mgmt.telnet",
    category: "Management Access",
    setting: "Telnet",
    label: "Telnet Administrative Access",
    description: "Legacy cleartext (port 23) remote administration service.",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Disabled",
    severity: "high",
    complianceRefs: [
      { framework: "cis", control: "CIS-4.2", label: "Telnet disabled" },
      { framework: "iso27001", control: "ISO A.9.2.2", label: "Secure log-on procedures" },
      { framework: "nist", control: "NIST SC-7", label: "Protected management interfaces" }
    ],
    finding: {
      title: "Telnet administrative access enabled",
      issueCategory: "Access Control",
      why: "Telnet does not provide encrypted communication and can expose authentication information to anyone on the network path.",
      fix: "Disable Telnet and use SSHv2 for all remote administration.",
      reference: "CS-BASELINE-MGMT-02"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "mgmt.https",
    category: "Management Access",
    setting: "HTTPS",
    label: "HTTPS Management Interface",
    description: "Web management interface served over TLS.",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Enabled",
    severity: "medium",
    complianceRefs: [
      { framework: "cis", control: "CIS-4.1", label: "HTTPS management interface enabled" },
      { framework: "iso27001", control: "ISO A.13.2.1", label: "Protected management traffic" }
    ],
    finding: {
      title: "HTTPS management interface disabled",
      issueCategory: "Access Control",
      why: "Removing the encrypted web management path leaves operators relying on weaker protocols for routine changes.",
      fix: "Enable the HTTPS management interface on the in-band management VLAN.",
      reference: "CS-BASELINE-MGMT-03"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "mgmt.http",
    category: "Management Access",
    setting: "HTTP",
    label: "Unencrypted HTTP Management",
    description: "Web management interface served over plain HTTP (port 80).",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Disabled",
    severity: "high",
    conflictsWith: ["mgmt.https"],
    complianceRefs: [
      { framework: "cis", control: "CIS-4.1", label: "Plaintext HTTP management disabled" },
      { framework: "nist", control: "NIST SC-8", label: "Transmission confidentiality" }
    ],
    finding: {
      title: "Unencrypted HTTP management enabled",
      issueCategory: "Access Control",
      why: "HTTP management sessions and credentials are transmitted in clear text and can be replayed by an attacker on-path.",
      fix: "Disable the HTTP listener and redirect management access to HTTPS.",
      reference: "CS-BASELINE-MGMT-04"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "mgmt.mgmtAcl",
    category: "Management Access",
    setting: "Mgmt ACL",
    label: "Management Source ACL",
    description: "Permitted source networks for administrative sessions.",
    type: "list",
    recommended: "10.10.0.0/16, 10.40.0.0/24",
    placeholder: "e.g. 10.10.0.0/16, 10.40.0.0/24",
    severity: "critical",
    complianceRefs: [
      { framework: "cis", control: "CIS-4.6", label: "Management access restricted to trusted sources" },
      { framework: "nist", control: "NIST AC-4", label: "Information flow enforcement" }
    ],
    finding: {
      title: "Management access allowed from any source",
      issueCategory: "Access Control",
      why: "An unrestricted source ACL exposes the full management plane to every reachable network, including untrusted segments.",
      fix: "Restrict the management ACL to the NOC, jump-host and identity subnets.",
      reference: "CS-BASELINE-MGMT-05"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "mgmt.consoleTimeout",
    category: "Management Access",
    setting: "Console Timeout",
    label: "Console Session Timeout",
    description: "Idle timeout applied to interactive CLI sessions.",
    type: "number",
    recommended: "5",
    range: { min: 1, max: 15, unit: "minutes" },
    unit: "minutes",
    severity: "medium",
    complianceRefs: [
      { framework: "iso27001", control: "ISO A.9.2.5", label: "Session termination after inactivity" }
    ],
    finding: {
      title: "Excessive console session timeout",
      issueCategory: "Access Control",
      why: "Long idle sessions leave a privileged session unattended, widening the window for session hijacking.",
      fix: "Set the console idle timeout to 5-15 minutes.",
      reference: "CS-BASELINE-MGMT-06"
    },
    deviceTypes: ALL_TYPES
  },
  /* ------------------------------------------------------------------ */
  /* Authentication                                                       */
  /* ------------------------------------------------------------------ */
  {
    id: "auth.passwordPolicy",
    category: "Authentication",
    setting: "Password Policy",
    label: "Password Policy Strength",
    description: "Minimum complexity enforced for local and shared credentials.",
    type: "select",
    options: [
      { value: "Strong", label: "Strong (16+ chars, complexity, rotation)" },
      { value: "Medium", label: "Medium (12+ chars, complexity)" },
      { value: "Weak", label: "Weak (8+ chars, no complexity)" },
      { value: "None", label: "None (no policy)" }
    ],
    recommended: "Strong",
    severity: "medium",
    complianceRefs: [
      { framework: "cis", control: "CIS-5.4", label: "Strong password policy" },
      { framework: "iso27001", control: "ISO A.9.4.2", label: "Password management" },
      { framework: "nist", control: "NIST IA-5", label: "Authenticator management" }
    ],
    finding: {
      title: "Weak password policy",
      issueCategory: "Authentication",
      why: "Weak local password policy makes credential guessing and brute force attacks against the management plane practical.",
      fix: "Enforce the Strong password policy (16+ characters, full complexity, 90-day rotation).",
      reference: "CS-BASELINE-AUTH-01"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "auth.mfa",
    category: "Authentication",
    setting: "MFA",
    label: "Multi-Factor Authentication",
    description: "Second factor required for privileged and administrative logins.",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Enabled",
    severity: "high",
    complianceRefs: [
      { framework: "iso27001", control: "ISO A.9.4.2", label: "Multi-factor authentication" },
      { framework: "nist", control: "NIST IA-2", label: "Multi-factor identification" }
    ],
    finding: {
      title: "Multi-factor authentication disabled for administrators",
      issueCategory: "Authentication",
      why: "Privileged logins rely on a single factor, so a stolen or guessed password grants full device control.",
      fix: "Enable MFA for all local, TACACS+ and SAML administrator accounts.",
      reference: "CS-BASELINE-AUTH-02"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "auth.lockout",
    category: "Authentication",
    setting: "Login Lockout",
    label: "Failed Login Lockout",
    description: "Automatic account lock after consecutive failed logins.",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Enabled",
    severity: "medium",
    complianceRefs: [
      { framework: "cis", control: "CIS-5.2", label: "Failed login lockout" },
      { framework: "nist", control: "NIST AC-7", label: "Unsuccessful logon attempts" }
    ],
    finding: {
      title: "Failed login lockout disabled",
      issueCategory: "Authentication",
      why: "Without lockout an attacker can attempt unlimited password guesses against the management plane.",
      fix: "Enable failed login lockout with a threshold of 5 attempts.",
      reference: "CS-BASELINE-AUTH-03"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "auth.lockoutThreshold",
    category: "Authentication",
    setting: "Lockout Threshold",
    label: "Failed Login Lockout Threshold",
    description: "Number of consecutive failures before the account locks.",
    type: "number",
    recommended: "5",
    range: { min: 3, max: 10, unit: "attempts" },
    unit: "attempts",
    severity: "low",
    complianceRefs: [{ framework: "cis", control: "CIS-5.2", label: "Lockout threshold 3-10 attempts" }],
    finding: {
      title: "Permissive account lockout threshold",
      issueCategory: "Authentication",
      why: "A high lockout threshold gives an attacker more guesses per account before being blocked.",
      fix: "Set the lockout threshold between 3 and 10 attempts.",
      reference: "CS-BASELINE-AUTH-04"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "auth.sharedAccounts",
    category: "Authentication",
    setting: "Shared Accounts",
    label: "Shared Administrative Accounts",
    description: "Presence of shared, non-attributable admin logins.",
    type: "toggle",
    options: [on("Present", "Enabled"), off("Absent", "Disabled")],
    recommended: "Disabled",
    severity: "medium",
    complianceRefs: [{ framework: "iso27001", control: "ISO A.9.2.3", label: "Account attribution" }],
    finding: {
      title: "Shared administrative account in use",
      issueCategory: "Authentication",
      why: "Shared logins break accountability: configuration changes cannot be attributed to a named engineer.",
      fix: "Remove shared accounts and provision named individual accounts.",
      reference: "CS-BASELINE-AUTH-05"
    },
    deviceTypes: ALL_TYPES
  },
  /* ------------------------------------------------------------------ */
  /* Firewall                                                             */
  /* ------------------------------------------------------------------ */
  {
    id: "fw.defaultInbound",
    category: "Firewall",
    setting: "Default Inbound",
    label: "Default Inbound Policy",
    description: "Action applied to inbound sessions that match no explicit rule.",
    type: "action",
    options: [
      { value: "DENY", label: "DENY (deny all unmatched inbound)" },
      { value: "ALLOW", label: "ALLOW (permit all unmatched inbound)" }
    ],
    recommended: "DENY",
    severity: "critical",
    complianceRefs: [
      { framework: "cis", control: "CIS-6.1", label: "Default deny inbound policy" },
      { framework: "iso27001", control: "ISO A.13.3.1", label: "Network segregation" },
      { framework: "nist", control: "NIST SC-7", label: "Boundary protection" }
    ],
    finding: {
      title: "Firewall default inbound policy allows traffic",
      issueCategory: "Firewall",
      why: "A permissive default inbound policy means any port not explicitly blocked is reachable from outside, which is the single most common cause of perimeter compromise.",
      fix: "Set the default inbound policy to DENY and add explicit, justified allow rules for required services.",
      reference: "CS-BASELINE-FW-01"
    },
    deviceTypes: ["firewall", "router"]
  },
  {
    id: "fw.anyAnyRule",
    category: "Firewall",
    setting: "Any/Any Rule",
    label: "Permit Any / Permit Any Rule",
    description: "Presence of a rule permitting any source to any destination on any port.",
    type: "toggle",
    options: [on("Present", "Enabled"), off("Absent", "Disabled")],
    recommended: "Disabled",
    severity: "critical",
    complianceRefs: [
      { framework: "cis", control: "CIS-6.2", label: "No any/any rules" },
      { framework: "nist", control: "NIST SC-7", label: "Boundary protection" }
    ],
    finding: {
      title: "Permit any / permit any rule present",
      issueCategory: "Firewall",
      why: "An any/any rule silently bypasses the entire rule base, so segmentation and access control become ineffective.",
      fix: "Delete the any/any rule and replace it with least-privilege rules scoped to required sources and destinations.",
      reference: "CS-BASELINE-FW-02"
    },
    deviceTypes: ["firewall", "router"]
  },
  {
    id: "fw.intraZonePolicy",
    category: "Firewall",
    setting: "Inter-Zone Policy",
    label: "Inter-Zone Default Policy",
    description: "Action applied to traffic between internal security zones.",
    type: "action",
    options: [
      { value: "DENY", label: "DENY (deny all inter-zone traffic)" },
      { value: "ALLOW", label: "ALLOW (permit inter-zone traffic)" }
    ],
    recommended: "DENY",
    severity: "high",
    complianceRefs: [
      { framework: "cis", control: "CIS-6.3", label: "Inter-zone segmentation" },
      { framework: "iso27001", control: "ISO A.13.3.1", label: "Network segregation" }
    ],
    finding: {
      title: "Inter-zone default policy allows traffic",
      issueCategory: "Firewall",
      why: "Permissive inter-zone policy collapses segmentation, letting a compromise in one zone reach every other zone.",
      fix: "Set the inter-zone default policy to DENY and add explicit zone-to-zone rules.",
      reference: "CS-BASELINE-FW-03"
    },
    deviceTypes: ["firewall", "router"]
  },
  {
    id: "fw.managementZone",
    category: "Firewall",
    setting: "Mgmt Zone Protection",
    label: "Management Zone Protection",
    description: "Protects the management zone from general user and server zones.",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Enabled",
    severity: "high",
    complianceRefs: [{ framework: "nist", control: "NIST SC-7", label: "Management plane protection" }],
    finding: {
      title: "Management zone protection disabled",
      issueCategory: "Firewall",
      why: "The management plane is then reachable from user zones, so a compromised workstation can attempt device takeover.",
      fix: "Enable management zone protection and restrict access to the NOC subnet.",
      reference: "CS-BASELINE-FW-04"
    },
    deviceTypes: ["firewall", "router"]
  },
  {
    id: "fw.defaultOutbound",
    category: "Firewall",
    setting: "Default Outbound",
    label: "Default Outbound Policy",
    description: "Action applied to outbound sessions that match no explicit rule.",
    type: "action",
    options: [
      { value: "DENY", label: "DENY (deny all unmatched outbound)" },
      { value: "ALLOW", label: "ALLOW (permit all unmatched outbound)" }
    ],
    recommended: "ALLOW",
    severity: "low",
    complianceRefs: [],
    finding: {
      title: "Outbound traffic restricted by default",
      issueCategory: "Firewall",
      why: "A deny-by-default egress policy without a defined rule base will break legitimate outbound application traffic.",
      fix: "Confirm the outbound rule base is complete, or set the outbound default back to ALLOW per baseline.",
      reference: "CS-BASELINE-FW-05"
    },
    deviceTypes: ["firewall", "router"]
  },
  /* ------------------------------------------------------------------ */
  /* Network Services                                                     */
  /* ------------------------------------------------------------------ */
  {
    id: "svc.ftp",
    category: "Network Services",
    setting: "FTP",
    label: "FTP Service (cleartext file transfer)",
    description: "Legacy FTP server enabled on the device.",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Disabled",
    severity: "high",
    complianceRefs: [
      { framework: "cis", control: "CIS-2.2", label: "FTP service disabled" },
      { framework: "nist", control: "NIST SC-8", label: "Transmission confidentiality" }
    ],
    finding: {
      title: "FTP service enabled",
      issueCategory: "Network Services",
      why: "FTP transmits files and credentials in clear text, allowing an on-path attacker to capture or modify transferred data.",
      fix: "Disable FTP and use SFTP over SSH or a managed file transfer service instead.",
      reference: "CS-BASELINE-SVC-01"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "svc.tftp",
    category: "Network Services",
    setting: "TFTP",
    label: "TFTP Service",
    description: "Trivial FTP service often required for image or config transfers.",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Disabled",
    severity: "high",
    complianceRefs: [
      { framework: "cis", control: "CIS-2.2", label: "TFTP service disabled" },
      { framework: "iso27001", control: "ISO A.13.2.1", label: "Secure file transfer" }
    ],
    finding: {
      title: "TFTP service enabled",
      issueCategory: "Network Services",
      why: "TFTP is unauthenticated and unencrypted, so it can be abused to push unauthorised configurations or firmware.",
      fix: "Disable TFTP; use SCP/SFTP for configuration and image transfers.",
      reference: "CS-BASELINE-SVC-02"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "svc.snmpVersion",
    category: "Network Services",
    setting: "SNMP",
    label: "SNMP Protocol Version",
    description: "SNMP version used for monitoring. v1/v2c use cleartext community strings.",
    type: "select",
    options: [
      { value: "v3", label: "SNMPv3 (auth + privacy)" },
      { value: "v2c", label: "SNMPv2c (community string)" },
      { value: "v1", label: "SNMPv1 (community string)" },
      { value: "Disabled", label: "SNMP disabled" }
    ],
    recommended: "v3",
    severity: "medium",
    complianceRefs: [{ framework: "cis", control: "CIS-2.3", label: "SNMPv3 or SNMP disabled" }],
    finding: {
      title: "SNMP configured with a legacy version",
      issueCategory: "Network Services",
      why: "SNMPv1/v2c community strings are sent in clear text and often left as vendor defaults, leaking device inventory and enabling configuration writes.",
      fix: "Migrate monitoring to SNMPv3 with authentication and privacy, then disable v1/v2c.",
      reference: "CS-BASELINE-SVC-03"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "svc.unusedServices",
    category: "Network Services",
    setting: "Unused Services",
    label: "Unused Network Services Detected",
    description: "Count of enabled services with no observed traffic in the last 30 days.",
    type: "number",
    recommended: "0",
    range: { min: 0, max: 0, unit: "services" },
    unit: "services",
    severity: "low",
    complianceRefs: [{ framework: "nist", control: "NIST CM-7", label: "Least functionality" }],
    finding: {
      title: "Unused network services detected",
      issueCategory: "Network Services",
      why: "Unused services expand the attack surface without delivering operational value.",
      fix: "Disable the unused services and record the change in the configuration baseline.",
      reference: "CS-BASELINE-SVC-04"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "svc.dns",
    category: "Network Services",
    setting: "DNS Service",
    label: "DNS Resolver Service",
    description: "Local DNS forwarder used by the device for name resolution.",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Enabled",
    severity: "low",
    complianceRefs: [],
    finding: {
      title: "DNS resolver service disabled",
      issueCategory: "Network Services",
      why: "Without a local resolver, time synchronisation, logging and certificate validation can fail, breaking audit trails.",
      fix: "Enable the local DNS resolver pointed at approved internal resolvers.",
      reference: "CS-BASELINE-SVC-05"
    },
    deviceTypes: ALL_TYPES
  },
  /* ------------------------------------------------------------------ */
  /* Logging                                                             */
  /* ------------------------------------------------------------------ */
  {
    id: "log.configChanges",
    category: "Logging",
    setting: "Config Logging",
    label: "Configuration Change Logging",
    description: "Logs every configuration commit with the responsible account.",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Enabled",
    severity: "high",
    complianceRefs: [
      { framework: "cis", control: "CIS-8.2", label: "Configuration change logging" },
      { framework: "iso27001", control: "ISO A.12.4.1", label: "Event logging" }
    ],
    finding: {
      title: "Configuration change logging disabled",
      issueCategory: "Logging",
      why: "Without change logging there is no audit trail showing who changed what, so unauthorised modifications cannot be detected or attributed.",
      fix: "Enable configuration change logging and export events to the central syslog collector.",
      reference: "CS-BASELINE-LOG-01"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "log.firewall",
    category: "Logging",
    setting: "Firewall Logging",
    label: "Firewall Session Logging",
    description: "Records permitted and denied sessions passing through the firewall.",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Enabled",
    severity: "medium",
    complianceRefs: [
      { framework: "cis", control: "CIS-8.3", label: "Firewall traffic logging" },
      { framework: "nist", control: "NIST AU-2", label: "Event logging" }
    ],
    finding: {
      title: "Firewall logging disabled",
      issueCategory: "Logging",
      why: "Without session logs there is no visibility into what crossed the perimeter, which delays detection and hampers incident response.",
      fix: "Enable firewall session logging at medium verbosity and forward to the SIEM collector.",
      reference: "CS-BASELINE-LOG-02"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "log.remoteSyslog",
    category: "Logging",
    setting: "Remote Syslog",
    label: "Remote Syslog Export",
    description: "Forwards device logs to the central log collector.",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Enabled",
    severity: "low",
    complianceRefs: [{ framework: "iso27001", control: "ISO A.12.4.4", label: "Log collection" }],
    finding: {
      title: "Remote syslog export disabled",
      issueCategory: "Logging",
      why: "Logs stored only on the device are lost if it is compromised or replaced, and cannot be correlated across the estate.",
      fix: "Configure remote syslog export to the central collector over a protected transport.",
      reference: "CS-BASELINE-LOG-03"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "log.retentionDays",
    category: "Logging",
    setting: "Log Retention",
    label: "Local Log Retention",
    description: "Number of days logs are retained on the device before rotation.",
    type: "number",
    recommended: "90",
    range: { min: 30, max: 365, unit: "days" },
    unit: "days",
    severity: "low",
    complianceRefs: [{ framework: "iso27001", control: "ISO A.12.4.1", label: "Log retention" }],
    finding: {
      title: "Insufficient local log retention",
      issueCategory: "Logging",
      why: "Short retention windows can hide the early stages of an intrusion before it is detected.",
      fix: "Retain local logs for at least 30 days and forward to long-term storage.",
      reference: "CS-BASELINE-LOG-04"
    },
    deviceTypes: ALL_TYPES
  },
  /* ------------------------------------------------------------------ */
  /* Encryption                                                          */
  /* ------------------------------------------------------------------ */
  {
    id: "enc.sshCipher",
    category: "Encryption",
    setting: "SSH Cipher",
    label: "SSH Cipher Suite",
    description: "Highest cipher strength accepted for SSH sessions.",
    type: "select",
    options: [
      { value: "AES-256-GCM", label: "aes256-gcm@openssh.com" },
      { value: "AES-128-GCM", label: "aes128-gcm@openssh.com" },
      { value: "3DES-CBC", label: "3des-cbc (legacy)" },
      { value: "DES-CBC", label: "des-cbc (broken)" }
    ],
    recommended: "AES-256-GCM",
    alsoCompliant: ["AES-128-GCM"],
    severity: "high",
    complianceRefs: [
      { framework: "cis", control: "CIS-4.4", label: "Strong SSH ciphers only" },
      { framework: "nist", control: "NIST SC-13", label: "Cryptographic protection" }
    ],
    finding: {
      title: "Weak SSH cipher suite permitted",
      issueCategory: "Encryption",
      why: "Legacy ciphers such as DES and 3DES are vulnerable to known plaintext attacks, so recorded sessions can be recovered.",
      fix: "Restrict SSH ciphers to aes256-gcm@openssh.com and aes128-gcm@openssh.com.",
      reference: "CS-BASELINE-ENC-01"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "enc.tlsVersion",
    category: "Encryption",
    setting: "TLS Version",
    label: "Minimum TLS Version",
    description: "Lowest TLS version accepted for HTTPS and service endpoints.",
    type: "select",
    options: [
      { value: "TLS 1.3", label: "TLS 1.3" },
      { value: "TLS 1.2", label: "TLS 1.2" },
      { value: "TLS 1.0", label: "TLS 1.0 (deprecated)" },
      { value: "SSLv3", label: "SSLv3 (broken)" }
    ],
    recommended: "TLS 1.2",
    alsoCompliant: ["TLS 1.3"],
    severity: "high",
    complianceRefs: [
      { framework: "cis", control: "CIS-3.3", label: "TLS 1.2 or stronger" },
      { framework: "iso27001", control: "ISO A.13.2.1", label: "Secure transport" }
    ],
    finding: {
      title: "Obsolete TLS version permitted",
      issueCategory: "Encryption",
      why: "SSLv3 and TLS 1.0 are vulnerable to known protocol attacks (POODLE, BEAST) and are rejected by modern browsers and clients.",
      fix: "Set the minimum accepted TLS version to TLS 1.2 or higher.",
      reference: "CS-BASELINE-ENC-02"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "enc.passwordStorage",
    category: "Encryption",
    setting: "Credential Storage",
    label: "Credential Storage Protection",
    description: "How locally stored credentials (SNMP communities, TACACS+ keys) are protected.",
    type: "select",
    options: [
      { value: "Encrypted (AES-256)", label: "Encrypted (AES-256, type 9)" },
      { value: "Hashed (SHA-256)", label: "Hashed (SHA-256)" },
      { value: "Plaintext", label: "Plaintext in the running config" }
    ],
    recommended: "Encrypted (AES-256)",
    severity: "critical",
    complianceRefs: [
      { framework: "cis", control: "CIS-5.4", label: "Credentials not stored in clear text" },
      { framework: "nist", control: "NIST IA-5", label: "Authenticator management" }
    ],
    finding: {
      title: "Credentials stored in plaintext",
      issueCategory: "Encryption",
      why: "Any configuration export, backup or support bundle leaks every shared secret on the device in clear text.",
      fix: "Enable the encrypted secret type and re-apply the shared secrets so they are stored as AES-256 ciphertext.",
      reference: "CS-BASELINE-ENC-03"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "enc.ikePolicy",
    category: "Encryption",
    setting: "IKE Policy",
    label: "IKE / IPsec Policy",
    description: "Internet Key Exchange version used for site-to-site tunnels.",
    type: "select",
    options: [
      { value: "IKEv2", label: "IKEv2 (recommended)" },
      { value: "IKEv1", label: "IKEv1 (legacy)" },
      { value: "Disabled", label: "IPsec disabled" }
    ],
    recommended: "IKEv2",
    severity: "high",
    complianceRefs: [{ framework: "nist", control: "NIST SC-13", label: "Strong key exchange" }],
    finding: {
      title: "Legacy IKEv1 policy in use",
      issueCategory: "Encryption",
      why: "IKEv1 uses weaker Diffie-Hellman groups and aggressive mode, which increases exposure to downgrade and rekey attacks.",
      fix: "Migrate site-to-site tunnels to IKEv2 with AES-256-GCM and a DH group of 14 or higher.",
      reference: "CS-BASELINE-ENC-04"
    },
    deviceTypes: ["firewall", "router"]
  },
  {
    id: "enc.wifiCipher",
    category: "Encryption",
    setting: "WLAN Encryption",
    label: "Wireless Encryption Suite",
    description: "WPA suite enforced on all controller-managed SSIDs.",
    type: "select",
    options: [
      { value: "WPA3-Enterprise", label: "WPA3-Enterprise" },
      { value: "WPA2-Enterprise", label: "WPA2-Enterprise (802.1X)" },
      { value: "WPA2-PSK", label: "WPA2-PSK (shared key)" },
      { value: "WEP", label: "WEP (broken)" },
      { value: "Open", label: "Open (no encryption)" }
    ],
    recommended: "WPA3-Enterprise",
    alsoCompliant: ["WPA2-Enterprise"],
    severity: "critical",
    complianceRefs: [
      { framework: "cis", control: "CIS-7.4", label: "WPA2/WPA3 with 802.1X" },
      { framework: "iso27001", control: "ISO A.13.3.1", label: "Wireless network security" }
    ],
    finding: {
      title: "Weak wireless encryption suite enabled",
      issueCategory: "Encryption",
      why: "A pre-shared key suite means anyone who learns the passphrase can decrypt traffic, and WEP/open SSIDs provide effectively no protection.",
      fix: "Migrate the SSID to WPA3-Enterprise with 802.1X and per-user credentials.",
      reference: "CS-BASELINE-ENC-05"
    },
    deviceTypes: ["wireless-controller"]
  },
  /* ------------------------------------------------------------------ */
  /* System                                                              */
  /* ------------------------------------------------------------------ */
  {
    id: "sys.firmwareSupport",
    category: "System",
    setting: "Firmware",
    label: "Firmware Support Status",
    description: "Vendor support status of the running firmware release.",
    type: "select",
    options: [
      { value: "Supported", label: "Supported release" },
      { value: "End-of-Life", label: "End-of-Life (no security patches)" },
      { value: "Unsupported", label: "Unsupported / pre-release" }
    ],
    recommended: "Supported",
    severity: "high",
    complianceRefs: [
      { framework: "nist", control: "NIST SI-2", label: "Flaw remediation" },
      { framework: "iso27001", control: "ISO A.12.6.1", label: "Technical vulnerability management" }
    ],
    finding: {
      title: "Firmware release has reached end-of-life",
      issueCategory: "Configuration",
      why: "End-of-life firmware no longer receives security patches, so known vendor flaws stay exploitable on this device.",
      fix: "Upgrade to the current supported release during the next maintenance window.",
      reference: "CS-BASELINE-SYS-01"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "sys.dnsServers",
    category: "System",
    setting: "DNS Servers",
    label: "Configured DNS Resolvers",
    description: "Resolvers used by the device for name lookups.",
    type: "list",
    recommended: "10.0.0.53, 10.0.0.54",
    placeholder: "e.g. 10.0.0.53, 10.0.0.54",
    severity: "medium",
    complianceRefs: [{ framework: "cis", control: "CIS-1.1", label: "Approved name servers only" }],
    finding: {
      title: "Unapproved external DNS resolver configured",
      issueCategory: "Configuration",
      why: "External resolvers leak internal name lookups to a third party and allow DNS-based redirection of management traffic.",
      fix: "Point the device at the approved internal resolvers only.",
      reference: "CS-BASELINE-SYS-02"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "sys.backupSchedule",
    category: "System",
    setting: "Config Backup",
    label: "Configuration Backup Schedule",
    description: "How often the running configuration is archived off the device.",
    type: "select",
    options: [
      { value: "Daily", label: "Daily" },
      { value: "Weekly", label: "Weekly" },
      { value: "Manual", label: "Manual only" }
    ],
    recommended: "Daily",
    severity: "low",
    complianceRefs: [{ framework: "iso27001", control: "ISO A.12.3.1", label: "Information backup" }],
    finding: {
      title: "Configuration backups are manual only",
      issueCategory: "Configuration",
      why: "Without an automated baseline snapshot, recovery after a failed change or compromise is slow and error-prone.",
      fix: "Schedule a daily configuration backup to the version-control repository.",
      reference: "CS-BASELINE-SYS-03"
    },
    deviceTypes: ALL_TYPES
  },
  {
    id: "sys.ntpSync",
    category: "System",
    setting: "NTP",
    label: "Time Synchronisation (NTP)",
    description: "Synchronises the device clock with approved time sources.",
    type: "toggle",
    options: [on("Enabled"), off("Disabled")],
    recommended: "Enabled",
    severity: "medium",
    complianceRefs: [{ framework: "iso27001", control: "ISO A.12.4.1", label: "Trusted time source" }],
    finding: {
      title: "Time synchronisation disabled",
      issueCategory: "Configuration",
      why: "Unsynchronised clocks make log correlation and forensic timelines unreliable, undermining the audit trail.",
      fix: "Enable NTP against two approved internal time sources.",
      reference: "CS-BASELINE-SYS-04"
    },
    deviceTypes: NO_SERVER
  }
];
var CONFIG_BY_ID = Object.fromEntries(
  CONFIG_SCHEMA.map((item2) => [item2.id, item2])
);
function schemaForType(type) {
  return CONFIG_SCHEMA.filter((item2) => item2.deviceTypes.includes(type));
}

// src/data/seedDevices.ts
var OS_BY_VENDOR = {
  Cisco: { router: "IOS XE 17.9.4a", switch: "IOS 15.2(7)E10", server: "NX-OS 10.2(3)F" },
  Fortinet: { firewall: "FortiOS 7.2.5 build1517" },
  "Palo Alto Networks": { firewall: "PAN-OS 10.2.3" },
  Juniper: { router: "Junos 21.4R3-S3.4" },
  MikroTik: { router: "RouterOS 7.13.3 (stable)", switch: "RouterOS 7.11.2 (stable)" },
  Aruba: { "wireless-controller": "ArubaOS 8.10.0.10" },
  Other: {}
};
var COLLECTED_VIA = {
  Cisco: "NETCONF / SSHv2 snapshot",
  Fortinet: "REST API v2 (demo collector)",
  "Palo Alto Networks": "XML API (demo collector)",
  Juniper: "JUNOS REST snapshot",
  MikroTik: "REST API (demo collector)",
  Aruba: "REST API (demo collector)",
  Other: "CLI snapshot (demo collector)"
};
var DEVICE_SEEDS = [
  {
    id: "dev-core-router-01",
    name: "Core-Router-01",
    type: "router",
    vendor: "Cisco",
    model: "Cisco ISR 4451 / ASR1002",
    ipAddress: "10.0.0.1",
    serial: "FDO-2417-A3C91",
    site: "HQ \xB7 Building A \xB7 MDF",
    environment: "Production",
    status: "online",
    lastScan: "2026-09-25T18:04:00Z",
    configVersion: "cfg-1841",
    deviations: {
      "mgmt.telnet": "Enabled",
      "auth.passwordPolicy": "Weak"
    }
  },
  {
    id: "dev-edge-firewall-01",
    name: "Edge-Firewall-01",
    type: "firewall",
    vendor: "Fortinet",
    model: "FortiGate 200F",
    ipAddress: "10.0.0.254",
    serial: "FGVMEV2419004317",
    site: "HQ \xB7 DMZ edge",
    environment: "Production",
    status: "online",
    lastScan: "2026-09-25T18:06:00Z",
    configVersion: "cfg-3907",
    deviations: {
      "fw.defaultInbound": "ALLOW",
      "enc.passwordStorage": "Plaintext",
      "log.firewall": "Disabled"
    }
  },
  {
    id: "dev-access-switch-01",
    name: "Access-Switch-01",
    type: "switch",
    vendor: "Cisco",
    model: "Cisco Catalyst C9300-48P",
    ipAddress: "10.0.10.2",
    serial: "FCW2511L0AB",
    site: "HQ \xB7 Floor 2 IDF",
    environment: "Production",
    status: "online",
    lastScan: "2026-09-25T18:07:00Z",
    configVersion: "cfg-0912"
  },
  {
    id: "dev-branch-fw-01",
    name: "Branch-FW-01",
    type: "firewall",
    vendor: "Palo Alto Networks",
    model: "PA-322",
    ipAddress: "10.10.0.1",
    serial: "001801094472",
    site: "Branch \xB7 Manchester",
    environment: "Branch",
    status: "online",
    lastScan: "2026-09-25T17:42:00Z",
    configVersion: "cfg-2255",
    deviations: {
      "fw.intraZonePolicy": "ALLOW"
    }
  },
  {
    id: "dev-wireless-controller-01",
    name: "Wireless-Controller-01",
    type: "wireless-controller",
    vendor: "Aruba",
    model: "Aruba 8320-48Y8C",
    ipAddress: "10.20.0.10",
    serial: "SG0ZBRK9C2L",
    site: "HQ \xB7 Floor 2 IDF",
    environment: "Production",
    status: "online",
    lastScan: "2026-09-25T18:09:00Z",
    configVersion: "cfg-1440"
  },
  {
    id: "dev-dist-switch-02",
    name: "Dist-Switch-02",
    type: "switch",
    vendor: "Cisco",
    model: "Cisco Catalyst C9500-24Q",
    ipAddress: "10.0.11.3",
    serial: "FCW2522L0ZZ",
    site: "HQ \xB7 Floor 3 IDF",
    environment: "Production",
    status: "online",
    lastScan: "2026-09-25T18:11:00Z",
    configVersion: "cfg-1683",
    deviations: {
      "mgmt.mgmtAcl": "0.0.0.0/0",
      "svc.tftp": "Enabled"
    }
  },
  {
    id: "dev-branch-router-02",
    name: "Branch-Router-02",
    type: "router",
    vendor: "Juniper",
    model: "Juniper MX204",
    ipAddress: "10.10.0.254",
    serial: "JN8712C0A118",
    site: "Branch \xB7 Manchester",
    environment: "Branch",
    status: "online",
    lastScan: "2026-09-25T17:45:00Z",
    configVersion: "cfg-0771",
    deviations: {
      "enc.ikePolicy": "IKEv1",
      "svc.snmpVersion": "v2c"
    }
  },
  {
    id: "dev-dmz-web-fw-01",
    name: "DMZ-Web-FW-01",
    type: "firewall",
    vendor: "Fortinet",
    model: "FortiGate 100E",
    ipAddress: "10.5.0.1",
    serial: "FGVMEV2318011664",
    site: "HQ \xB7 DMZ segment",
    environment: "DMZ",
    status: "online",
    lastScan: "2026-09-25T18:14:00Z",
    configVersion: "cfg-3312",
    deviations: {
      "fw.defaultInbound": "ALLOW",
      "sys.dnsServers": "8.8.8.8, 8.8.4.4",
      "sys.backupSchedule": "Weekly"
    }
  },
  {
    id: "dev-lab-switch-01",
    name: "Lab-Switch-01",
    type: "switch",
    vendor: "MikroTik",
    model: "MikroTik CRS326-24G-2S+",
    ipAddress: "10.30.0.2",
    serial: "H4X9JAB41C",
    site: "HQ \xB7 Lab bench 4",
    environment: "Lab",
    status: "offline",
    lastScan: "2026-09-24T09:15:00Z",
    configVersion: "cfg-0418",
    deviations: {
      "mgmt.telnet": "Enabled",
      "enc.sshCipher": "DES-CBC"
    }
  },
  {
    id: "dev-guest-wlc-02",
    name: "Guest-WLC-02",
    type: "wireless-controller",
    vendor: "Aruba",
    model: "Aruba 2530-48G",
    ipAddress: "10.21.0.10",
    serial: "SG0ZBRKD91M",
    site: "HQ \xB7 Guest lobby",
    environment: "Production",
    status: "online",
    lastScan: "2026-09-25T18:16:00Z",
    configVersion: "cfg-1301",
    deviations: {
      "enc.wifiCipher": "WPA2-PSK",
      "auth.mfa": "Disabled"
    }
  },
  {
    id: "dev-app-server-01",
    name: "App-Server-01",
    type: "server",
    vendor: "Cisco",
    model: "Cisco UCS C220 M5",
    ipAddress: "10.40.0.11",
    serial: "CIMC2219F0AB",
    site: "HQ \xB7 DC rack 12",
    environment: "Production",
    status: "online",
    lastScan: "2026-09-25T18:19:00Z",
    configVersion: "cfg-5094",
    deviations: {
      "enc.tlsVersion": "SSLv3",
      "enc.passwordStorage": "Plaintext"
    }
  },
  {
    id: "dev-mgmt-gateway-01",
    name: "Mgmt-Gateway-01",
    type: "router",
    vendor: "MikroTik",
    model: "MikroTik CCR2004-1G-12S+2XS",
    ipAddress: "10.99.0.1",
    serial: "7T4K2XQ1PN",
    site: "HQ \xB7 Out-of-band management",
    environment: "Management",
    status: "online",
    lastScan: "2026-09-25T18:21:00Z",
    configVersion: "cfg-0620",
    deviations: {
      "sys.firmwareSupport": "End-of-Life",
      "auth.passwordPolicy": "None",
      "auth.lockout": "Disabled"
    }
  }
];
function buildConfig(seed) {
  const values = {};
  for (const def of schemaForType(seed.type)) {
    values[def.id] = seed.deviations?.[def.id] ?? def.recommended;
  }
  return {
    values,
    osVersion: OS_BY_VENDOR[seed.vendor]?.[seed.type] ?? "Vendor OS 12.4.3",
    configVersion: seed.configVersion,
    collectedVia: COLLECTED_VIA[seed.vendor]
  };
}
var seedDevices = DEVICE_SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  type: seed.type,
  vendor: seed.vendor,
  model: seed.model,
  ipAddress: seed.ipAddress,
  serial: seed.serial,
  site: seed.site,
  environment: seed.environment,
  status: seed.status,
  lastScan: seed.lastScan,
  config: buildConfig(seed)
}));
var seedConfigMap = Object.fromEntries(
  seedDevices.map((device2) => [device2.id, device2.config])
);

// src/data/seedChanges.ts
var seedChanges = [
  {
    id: "CHG-001",
    deviceId: "dev-core-router-01",
    deviceName: "Core-Router-01",
    configItemId: "mgmt.https",
    setting: "HTTPS",
    category: "Management Access",
    oldValue: "Disabled",
    newValue: "Enabled",
    recommended: "Enabled",
    validationStatus: "validated",
    changeStatus: "applied",
    timestamp: "2026-09-18T09:12:00Z",
    actor: "a.mercer@demo",
    source: "remediation",
    note: "Re-enabled the encrypted web management path during the HTTPS hardening window."
  },
  {
    id: "CHG-002",
    deviceId: "dev-access-switch-01",
    deviceName: "Access-Switch-01",
    configItemId: "mgmt.ssh",
    setting: "SSH",
    category: "Management Access",
    oldValue: "Disabled",
    newValue: "Enabled",
    recommended: "Enabled",
    validationStatus: "validated",
    changeStatus: "applied",
    timestamp: "2026-09-19T14:38:00Z",
    actor: "j.okafor@demo",
    source: "baseline-template",
    note: "Applied from the Secure Switch Baseline template."
  },
  {
    id: "CHG-003",
    deviceId: "dev-wireless-controller-01",
    deviceName: "Wireless-Controller-01",
    configItemId: "enc.wifiCipher",
    setting: "WLAN Encryption",
    category: "Encryption",
    oldValue: "WPA2-Enterprise",
    newValue: "WPA3-Enterprise",
    recommended: "WPA3-Enterprise",
    validationStatus: "validated",
    changeStatus: "applied",
    timestamp: "2026-09-21T08:02:00Z",
    actor: "l.novak@demo",
    source: "remediation",
    note: "SSID CORP-SEC migrated to WPA3-Enterprise with 802.1X."
  },
  {
    id: "CHG-004",
    deviceId: "dev-edge-firewall-01",
    deviceName: "Edge-Firewall-01",
    configItemId: "log.remoteSyslog",
    setting: "Remote Syslog",
    category: "Logging",
    oldValue: "Disabled",
    newValue: "Enabled",
    recommended: "Enabled",
    validationStatus: "validated",
    changeStatus: "applied",
    timestamp: "2026-09-22T11:45:00Z",
    actor: "a.mercer@demo",
    source: "remediation",
    note: "Session logs now exported to the central collector (10.0.0.20:514)."
  },
  {
    id: "CHG-005",
    deviceId: "dev-branch-fw-01",
    deviceName: "Branch-FW-01",
    configItemId: "enc.tlsVersion",
    setting: "TLS Version",
    category: "Encryption",
    oldValue: "TLS 1.0",
    newValue: "TLS 1.2",
    recommended: "TLS 1.2",
    validationStatus: "validated",
    changeStatus: "applied",
    timestamp: "2026-09-23T16:20:00Z",
    actor: "s.iyer@demo",
    source: "remediation",
    note: "Minimum TLS raised after the branch penetration test report."
  },
  {
    id: "CHG-006",
    deviceId: "dev-dmz-web-fw-01",
    deviceName: "DMZ-Web-FW-01",
    configItemId: "sys.backupSchedule",
    setting: "Config Backup",
    category: "System",
    oldValue: "Weekly",
    newValue: "Daily",
    recommended: "Daily",
    validationStatus: "pending",
    changeStatus: "pending",
    timestamp: "2026-09-24T10:05:00Z",
    actor: "j.okafor@demo",
    source: "manual",
    note: "Drafted change \u2014 configuration validation has not been run yet."
  },
  {
    id: "CHG-007",
    deviceId: "dev-app-server-01",
    deviceName: "App-Server-01",
    configItemId: "svc.dns",
    setting: "DNS Service",
    category: "Network Services",
    oldValue: "Enabled",
    newValue: "Disabled",
    recommended: "Enabled",
    validationStatus: "validated",
    changeStatus: "reverted",
    timestamp: "2026-09-24T13:30:00Z",
    actor: "l.novak@demo",
    source: "manual",
    note: "Rolled back in the demo after disabling name resolution broke the monitoring agent."
  }
];

// src/data/complianceChecks.ts
var enum_ = "Enabled";
var dis = "Disabled";
var is = (v) => v !== void 0;
var COMPLIANCE_CHECKS = [
  {
    id: "secure-remote-admin",
    name: "Encrypted remote administration only",
    requirement: "Remote administration must use an encrypted protocol; cleartext protocols must be disabled.",
    category: "Management Access",
    weight: 10,
    severity: "high",
    frameworks: ["cis", "nist"],
    inspects: ["mgmt.ssh", "mgmt.telnet"],
    evaluate: (v) => v["mgmt.ssh"] === enum_ && v["mgmt.telnet"] === dis ? "pass" : "fail",
    currentState: (v) => `SSH ${v["mgmt.ssh"] ?? "n/a"} \xB7 Telnet ${v["mgmt.telnet"] ?? "n/a"}`,
    expectedState: "SSH Enabled \xB7 Telnet Disabled",
    remediation: "Enable SSHv2 and disable the Telnet listener on the management interface."
  },
  {
    id: "no-telnet",
    name: "Telnet service disabled",
    requirement: "The Telnet service must be disabled on all network devices.",
    category: "Management Access",
    weight: 8,
    severity: "high",
    frameworks: ["cis", "iso27001", "nist"],
    inspects: ["mgmt.telnet"],
    evaluate: (v) => v["mgmt.telnet"] === dis ? "pass" : "fail",
    currentState: (v) => `Telnet ${v["mgmt.telnet"] ?? "n/a"}`,
    expectedState: "Telnet Disabled",
    remediation: "Disable Telnet and manage the device over SSHv2."
  },
  {
    id: "no-http-mgmt",
    name: "Unencrypted HTTP management disabled",
    requirement: "The plain HTTP management listener must be disabled; HTTPS must be used instead.",
    category: "Management Access",
    weight: 8,
    severity: "high",
    frameworks: ["cis", "nist"],
    inspects: ["mgmt.http"],
    evaluate: (v) => v["mgmt.http"] === dis ? "pass" : "fail",
    currentState: (v) => `HTTP management ${v["mgmt.http"] ?? "n/a"}`,
    expectedState: "HTTP Disabled",
    remediation: "Disable the HTTP listener and redirect operators to the HTTPS interface."
  },
  {
    id: "https-mgmt",
    name: "HTTPS management interface enabled",
    requirement: "A TLS-protected management interface must be available to operators.",
    category: "Management Access",
    weight: 6,
    severity: "medium",
    frameworks: ["cis", "iso27001"],
    inspects: ["mgmt.https"],
    evaluate: (v) => v["mgmt.https"] === enum_ ? "pass" : "fail",
    currentState: (v) => `HTTPS ${v["mgmt.https"] ?? "n/a"}`,
    expectedState: "HTTPS Enabled",
    remediation: "Enable the HTTPS management interface on the in-band management VLAN."
  },
  {
    id: "mgmt-source-restriction",
    name: "Management access restricted to trusted sources",
    requirement: "Administrative sessions must only be accepted from approved internal subnets.",
    category: "Management Access",
    weight: 10,
    severity: "critical",
    frameworks: ["cis", "nist"],
    inspects: ["mgmt.mgmtAcl"],
    evaluate: (v) => {
      const acl = v["mgmt.mgmtAcl"];
      if (!is(acl)) return "na";
      const unrestricted = acl.includes("0.0.0.0/0") || acl.trim() === "any";
      return unrestricted ? "fail" : "pass";
    },
    currentState: (v) => `Mgmt ACL: ${v["mgmt.mgmtAcl"] ?? "n/a"}`,
    expectedState: "Restricted to approved internal subnets",
    remediation: "Replace the any/any management ACL with the approved NOC and jump-host subnets."
  },
  {
    id: "session-timeout",
    name: "Privileged session timeout enforced",
    requirement: "Interactive administrative sessions must terminate after a short idle period.",
    category: "Management Access",
    weight: 5,
    severity: "medium",
    frameworks: ["iso27001"],
    inspects: ["mgmt.consoleTimeout"],
    evaluate: (v) => {
      const raw = v["mgmt.consoleTimeout"];
      if (!is(raw)) return "na";
      const minutes = Number(raw);
      return Number.isFinite(minutes) && minutes > 0 && minutes <= 15 ? "pass" : "fail";
    },
    currentState: (v) => `Console timeout: ${v["mgmt.consoleTimeout"] ?? "n/a"} minutes`,
    expectedState: "15 minutes or less",
    remediation: "Reduce the console idle timeout to 5-15 minutes."
  },
  {
    id: "strong-password-policy",
    name: "Strong password policy enforced",
    requirement: "Local and shared credentials must follow a strong password policy.",
    category: "Authentication",
    weight: 10,
    severity: "medium",
    frameworks: ["cis", "iso27001", "nist"],
    inspects: ["auth.passwordPolicy"],
    evaluate: (v) => v["auth.passwordPolicy"] === "Strong" ? "pass" : "fail",
    currentState: (v) => `Password policy: ${v["auth.passwordPolicy"] ?? "n/a"}`,
    expectedState: "Strong (16+ chars, complexity, rotation)",
    remediation: "Apply the Strong password policy to local and TACACS+ accounts."
  },
  {
    id: "mfa-admin",
    name: "Multi-factor authentication for administrators",
    requirement: "Privileged logins must require a second authentication factor.",
    category: "Authentication",
    weight: 10,
    severity: "high",
    frameworks: ["iso27001", "nist"],
    inspects: ["auth.mfa"],
    evaluate: (v) => v["auth.mfa"] === enum_ ? "pass" : "fail",
    currentState: (v) => `MFA ${v["auth.mfa"] ?? "n/a"}`,
    expectedState: "MFA Enabled",
    remediation: "Enable MFA for all privileged and administrative accounts."
  },
  {
    id: "login-lockout",
    name: "Failed login lockout enabled",
    requirement: "Repeated failed logins must lock the account within a small number of attempts.",
    category: "Authentication",
    weight: 6,
    severity: "medium",
    frameworks: ["cis", "nist"],
    inspects: ["auth.lockout", "auth.lockoutThreshold"],
    evaluate: (v) => {
      if (v["auth.lockout"] !== enum_) return "fail";
      const threshold = Number(v["auth.lockoutThreshold"]);
      return !Number.isFinite(threshold) || threshold < 3 || threshold > 10 ? "fail" : "pass";
    },
    currentState: (v) => `Lockout ${v["auth.lockout"] ?? "n/a"} \xB7 threshold ${v["auth.lockoutThreshold"] ?? "n/a"}`,
    expectedState: "Lockout Enabled \xB7 threshold 3-10",
    remediation: "Enable lockout and set the threshold between 3 and 10 attempts."
  },
  {
    id: "account-attribution",
    name: "Named accounts only (no shared logins)",
    requirement: "Every administrative action must be attributable to an individual account.",
    category: "Authentication",
    weight: 5,
    severity: "medium",
    frameworks: ["iso27001"],
    inspects: ["auth.sharedAccounts"],
    evaluate: (v) => v["auth.sharedAccounts"] === dis ? "pass" : "fail",
    currentState: (v) => `Shared accounts ${v["auth.sharedAccounts"] ?? "n/a"}`,
    expectedState: "Shared accounts Absent",
    remediation: "Remove shared admin logins and provision named accounts."
  },
  {
    id: "default-deny-inbound",
    name: "Default inbound policy is deny",
    requirement: "Unmatched inbound traffic must be denied by default at the perimeter.",
    category: "Firewall",
    weight: 12,
    severity: "critical",
    frameworks: ["cis", "iso27001", "nist"],
    inspects: ["fw.defaultInbound"],
    evaluate: (v) => {
      const value = v["fw.defaultInbound"];
      if (!is(value)) return "na";
      return value === "DENY" ? "pass" : "fail";
    },
    currentState: (v) => `Default inbound: ${v["fw.defaultInbound"] ?? "n/a"}`,
    expectedState: "Default Inbound DENY",
    remediation: "Set the default inbound policy to DENY and add explicit allow rules per service."
  },
  {
    id: "no-any-any",
    name: "No permit any / permit any rules",
    requirement: "The rule base must not contain a rule permitting any source to any destination.",
    category: "Firewall",
    weight: 12,
    severity: "critical",
    frameworks: ["cis", "nist"],
    inspects: ["fw.anyAnyRule"],
    evaluate: (v) => {
      if (!is(v["fw.anyAnyRule"])) return "na";
      return v["fw.anyAnyRule"] === dis ? "pass" : "fail";
    },
    currentState: (v) => `Any/any rule ${v["fw.anyAnyRule"] ?? "n/a"}`,
    expectedState: "Any/Any Rule Absent",
    remediation: "Delete the any/any rule and replace it with least-privilege rules."
  },
  {
    id: "inter-zone-segmentation",
    name: "Inter-zone segmentation enforced",
    requirement: "Traffic between internal security zones must be denied by default.",
    category: "Firewall",
    weight: 8,
    severity: "high",
    frameworks: ["cis", "iso27001"],
    inspects: ["fw.intraZonePolicy"],
    evaluate: (v) => {
      if (!is(v["fw.intraZonePolicy"])) return "na";
      return v["fw.intraZonePolicy"] === "DENY" ? "pass" : "fail";
    },
    currentState: (v) => `Inter-zone default: ${v["fw.intraZonePolicy"] ?? "n/a"}`,
    expectedState: "Inter-Zone DENY",
    remediation: "Set the inter-zone default policy to DENY and define explicit zone pairs."
  },
  {
    id: "mgmt-zone-protection",
    name: "Management zone protected",
    requirement: "The management zone must be isolated from user and server zones.",
    category: "Firewall",
    weight: 8,
    severity: "high",
    frameworks: ["nist"],
    inspects: ["fw.managementZone"],
    evaluate: (v) => {
      if (!is(v["fw.managementZone"])) return "na";
      return v["fw.managementZone"] === enum_ ? "pass" : "fail";
    },
    currentState: (v) => `Management zone protection ${v["fw.managementZone"] ?? "n/a"}`,
    expectedState: "Management Zone Protection Enabled",
    remediation: "Enable management zone protection on the perimeter firewall."
  },
  {
    id: "firewall-logging",
    name: "Firewall traffic logging enabled",
    requirement: "Permitted and denied sessions must be recorded for investigation.",
    category: "Logging",
    weight: 8,
    severity: "medium",
    frameworks: ["cis", "nist"],
    inspects: ["log.firewall"],
    evaluate: (v) => v["log.firewall"] === enum_ ? "pass" : "fail",
    currentState: (v) => `Firewall logging ${v["log.firewall"] ?? "n/a"}`,
    expectedState: "Firewall Logging Enabled",
    remediation: "Enable firewall session logging and export events to the SIEM collector."
  },
  {
    id: "config-change-logging",
    name: "Configuration change logging enabled",
    requirement: "Every configuration commit must be logged with the responsible account.",
    category: "Logging",
    weight: 8,
    severity: "high",
    frameworks: ["cis", "iso27001"],
    inspects: ["log.configChanges"],
    evaluate: (v) => v["log.configChanges"] === enum_ ? "pass" : "fail",
    currentState: (v) => `Config change logging ${v["log.configChanges"] ?? "n/a"}`,
    expectedState: "Config Logging Enabled",
    remediation: "Enable configuration change logging on the device."
  },
  {
    id: "remote-log-collection",
    name: "Logs collected off-device",
    requirement: "Device logs must be forwarded to a central collector and retained.",
    category: "Logging",
    weight: 6,
    severity: "low",
    frameworks: ["iso27001", "nist"],
    inspects: ["log.remoteSyslog", "log.retentionDays"],
    evaluate: (v) => {
      if (v["log.remoteSyslog"] !== enum_) return "fail";
      const days = Number(v["log.retentionDays"]);
      return !Number.isFinite(days) || days < 30 ? "fail" : "pass";
    },
    currentState: (v) => `Remote syslog ${v["log.remoteSyslog"] ?? "n/a"} \xB7 retention ${v["log.retentionDays"] ?? "n/a"}d`,
    expectedState: "Remote Syslog Enabled \xB7 retention \u2265 30 days",
    remediation: "Enable remote syslog export and keep at least 30 days of local retention."
  },
  {
    id: "no-cleartext-transfer",
    name: "Cleartext file transfer services disabled",
    requirement: "FTP and TFTP must be disabled; use SFTP for file transfer.",
    category: "Network Services",
    weight: 10,
    severity: "high",
    frameworks: ["cis", "iso27001", "nist"],
    inspects: ["svc.ftp", "svc.tftp"],
    evaluate: (v) => v["svc.ftp"] === dis && v["svc.tftp"] === dis ? "pass" : "fail",
    currentState: (v) => `FTP ${v["svc.ftp"] ?? "n/a"} \xB7 TFTP ${v["svc.tftp"] ?? "n/a"}`,
    expectedState: "FTP Disabled \xB7 TFTP Disabled",
    remediation: "Disable FTP and TFTP; transfer files over SFTP."
  },
  {
    id: "snmp-hardening",
    name: "SNMPv3 or SNMP disabled",
    requirement: "SNMP must use v3 with authentication/privacy, or be disabled entirely.",
    category: "Network Services",
    weight: 6,
    severity: "medium",
    frameworks: ["cis"],
    inspects: ["svc.snmpVersion"],
    evaluate: (v) => {
      const version = v["svc.snmpVersion"];
      if (!is(version)) return "na";
      return version === "v3" || version === "Disabled" ? "pass" : "fail";
    },
    currentState: (v) => `SNMP ${v["svc.snmpVersion"] ?? "n/a"}`,
    expectedState: "SNMPv3 or SNMP disabled",
    remediation: "Migrate monitoring to SNMPv3 with authentication and privacy."
  },
  {
    id: "least-functionality",
    name: "Least functionality (no unused services)",
    requirement: "Services with no observed usage must be disabled to reduce attack surface.",
    category: "Network Services",
    weight: 5,
    severity: "low",
    frameworks: ["nist"],
    inspects: ["svc.unusedServices"],
    evaluate: (v) => {
      const count = Number(v["svc.unusedServices"]);
      if (!Number.isFinite(count)) return "na";
      return count <= 0 ? "pass" : "fail";
    },
    currentState: (v) => `${v["svc.unusedServices"] ?? "0"} unused service(s) detected`,
    expectedState: "0 unused services",
    remediation: "Disable the unused services and record the decision in the baseline."
  },
  {
    id: "strong-crypto",
    name: "Strong cipher suites enforced",
    requirement: "Legacy ciphers (DES, 3DES, SSLv3) must not be accepted.",
    category: "Encryption",
    weight: 10,
    severity: "high",
    frameworks: ["cis", "nist"],
    inspects: ["enc.sshCipher", "enc.tlsVersion"],
    evaluate: (v) => {
      const cipher = v["enc.sshCipher"];
      const tls = v["enc.tlsVersion"];
      if (!is(cipher) && !is(tls)) return "na";
      const cipherOk = !is(cipher) || cipher === "AES-256-GCM" || cipher === "AES-128-GCM";
      const tlsOk = !is(tls) || tls === "TLS 1.2" || tls === "TLS 1.3";
      return cipherOk && tlsOk ? "pass" : "fail";
    },
    currentState: (v) => `SSH cipher ${v["enc.sshCipher"] ?? "n/a"} \xB7 TLS ${v["enc.tlsVersion"] ?? "n/a"}`,
    expectedState: "AES-256-GCM \xB7 TLS 1.2 or higher",
    remediation: "Restrict SSH ciphers to AES-GCM and raise the minimum TLS version to 1.2."
  },
  {
    id: "strong-key-exchange",
    name: "Modern key exchange (IKEv2)",
    requirement: "Site-to-site tunnels must negotiate with IKEv2.",
    category: "Encryption",
    weight: 7,
    severity: "high",
    frameworks: ["nist"],
    inspects: ["enc.ikePolicy"],
    evaluate: (v) => {
      if (!is(v["enc.ikePolicy"])) return "na";
      return v["enc.ikePolicy"] === "IKEv2" ? "pass" : "fail";
    },
    currentState: (v) => `IKE policy ${v["enc.ikePolicy"] ?? "n/a"}`,
    expectedState: "IKEv2",
    remediation: "Migrate the tunnel to IKEv2 with AES-256-GCM and DH group 14+."
  },
  {
    id: "wireless-encryption",
    name: "Wireless networks encrypted with 802.1X",
    requirement: "WLANs must use WPA2/WPA3-Enterprise; shared keys and open SSIDs are prohibited.",
    category: "Encryption",
    weight: 10,
    severity: "critical",
    frameworks: ["cis", "iso27001"],
    inspects: ["enc.wifiCipher"],
    evaluate: (v) => {
      if (!is(v["enc.wifiCipher"])) return "na";
      return v["enc.wifiCipher"] === "WPA3-Enterprise" || v["enc.wifiCipher"] === "WPA2-Enterprise" ? "pass" : "fail";
    },
    currentState: (v) => `WLAN encryption ${v["enc.wifiCipher"] ?? "n/a"}`,
    expectedState: "WPA3-Enterprise (or WPA2-Enterprise)",
    remediation: "Migrate the SSID to WPA3-Enterprise with per-user 802.1X credentials."
  },
  {
    id: "no-plaintext-credentials",
    name: "Credentials not stored in clear text",
    requirement: "Shared secrets and community strings must be stored encrypted in the running configuration.",
    category: "Encryption",
    weight: 12,
    severity: "critical",
    frameworks: ["cis", "nist"],
    inspects: ["enc.passwordStorage"],
    evaluate: (v) => {
      if (!is(v["enc.passwordStorage"])) return "na";
      return v["enc.passwordStorage"] === "Plaintext" ? "fail" : "pass";
    },
    currentState: (v) => `Credential storage: ${v["enc.passwordStorage"] ?? "n/a"}`,
    expectedState: "Encrypted (AES-256) or Hashed (SHA-256)",
    remediation: "Enable the encrypted secret type and re-apply the shared secrets."
  },
  {
    id: "supported-firmware",
    name: "Firmware in vendor support",
    requirement: "Devices must run a firmware release that still receives security patches.",
    category: "System",
    weight: 7,
    severity: "high",
    frameworks: ["nist", "iso27001"],
    inspects: ["sys.firmwareSupport"],
    evaluate: (v) => {
      if (!is(v["sys.firmwareSupport"])) return "na";
      return v["sys.firmwareSupport"] === "Supported" ? "pass" : "fail";
    },
    currentState: (v) => `Firmware support: ${v["sys.firmwareSupport"] ?? "n/a"}`,
    expectedState: "Supported release",
    remediation: "Upgrade to the current supported release in the next maintenance window."
  },
  {
    id: "approved-resolvers",
    name: "Approved DNS resolvers only",
    requirement: "Devices must not be configured to use external public resolvers.",
    category: "System",
    weight: 5,
    severity: "medium",
    frameworks: ["cis"],
    inspects: ["sys.dnsServers"],
    evaluate: (v) => {
      const servers = v["sys.dnsServers"];
      if (!is(servers)) return "na";
      const external = servers.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0).some((entry) => !/^10\./.test(entry) && !/^192\.168\./.test(entry) && !/^172\.(1[6-9]|2\d|3[01])\./.test(entry));
      return external ? "fail" : "pass";
    },
    currentState: (v) => `Resolvers: ${v["sys.dnsServers"] ?? "n/a"}`,
    expectedState: "Approved internal resolvers only",
    remediation: "Replace public resolvers with the approved internal DNS servers."
  },
  {
    id: "trusted-time",
    name: "Trusted time source configured",
    requirement: "Devices must synchronise time from approved internal sources.",
    category: "System",
    weight: 5,
    severity: "medium",
    frameworks: ["iso27001"],
    inspects: ["sys.ntpSync"],
    evaluate: (v) => {
      if (!is(v["sys.ntpSync"])) return "na";
      return v["sys.ntpSync"] === enum_ ? "pass" : "fail";
    },
    currentState: (v) => `NTP ${v["sys.ntpSync"] ?? "n/a"}`,
    expectedState: "NTP Enabled",
    remediation: "Enable NTP against two approved internal time sources."
  },
  {
    id: "automated-backup",
    name: "Automated configuration backup",
    requirement: "Running configurations must be archived on a schedule, not manually.",
    category: "System",
    weight: 4,
    severity: "low",
    frameworks: ["iso27001"],
    inspects: ["sys.backupSchedule"],
    evaluate: (v) => {
      if (!is(v["sys.backupSchedule"])) return "na";
      return v["sys.backupSchedule"] === "Manual" ? "fail" : "pass";
    },
    currentState: (v) => `Backup schedule: ${v["sys.backupSchedule"] ?? "n/a"}`,
    expectedState: "Daily or Weekly",
    remediation: "Schedule a daily configuration backup to the version-control repository."
  }
];
var CHECK_BY_ID = Object.fromEntries(
  COMPLIANCE_CHECKS.map((check) => [check.id, check])
);

// src/lib/analysis.ts
var SEVERITY_ORDER = ["critical", "high", "medium", "low"];
var SEVERITY_WEIGHT = {
  critical: 1.6,
  high: 1,
  medium: 0.5,
  low: 0.2
};
var DEVICE_POSTURE_SCALE = 12;
var CONTROL_SEVERITY_WEIGHT = {
  critical: 2.6,
  high: 1.5,
  medium: 0.8,
  low: 0.35
};
function materialiseConfig(device2) {
  return CONFIG_SCHEMA.filter((def) => def.deviceTypes.includes(device2.type)).map((def) => ({
    ...def,
    value: device2.config.values[def.id] ?? def.recommended
  }));
}
var numericInRange = (item2, value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return false;
  if (!item2.range) return true;
  return parsed >= item2.range.min && parsed <= item2.range.max;
};
function isValueCompliant(item2, value) {
  const trimmed = value.trim();
  if (item2.type === "number" || item2.range) return numericInRange(item2, trimmed);
  if (item2.type === "list") {
    if (item2.id === "mgmt.mgmtAcl") {
      return !(trimmed.includes("0.0.0.0/0") || trimmed === "any");
    }
    if (item2.id === "sys.dnsServers") {
      const entries = trimmed.split(",").map((entry) => entry.trim()).filter(Boolean);
      if (entries.length === 0) return false;
      return entries.every(
        (entry) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry)
      );
    }
    return entriesAreValid(trimmed);
  }
  if (trimmed === item2.recommended) return true;
  return (item2.alsoCompliant ?? []).includes(trimmed);
}
function entriesAreValid(value) {
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return entries.length > 0;
}
function complianceVerdict(item2, value) {
  if (isValueCompliant(item2, value)) {
    if (item2.range && value.trim() !== item2.recommended) {
      return {
        compliant: true,
        reason: `Within the allowed range (${item2.range.min}-${item2.range.max} ${item2.range.unit}).`
      };
    }
    if (value.trim() === item2.recommended) {
      return { compliant: true, reason: "Matches the CyberSure baseline value." };
    }
    return { compliant: true, reason: "Accepted as an equivalent hardened value." };
  }
  return { compliant: false, reason: describeDeviation(item2, value) };
}
function describeDeviation(item2, value) {
  const trimmed = value.trim();
  switch (item2.id) {
    case "mgmt.mgmtAcl":
      return "Allows any source network (0.0.0.0/0) to reach the management plane.";
    case "sys.dnsServers":
      return "Points at a public resolver outside the approved internal ranges.";
    default:
      break;
  }
  if (item2.range) {
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return "Value is not a valid number.";
    if (parsed < item2.range.min) {
      return `${trimmed} ${item2.range.unit} is below the allowed minimum of ${item2.range.min}.`;
    }
    return `${trimmed} ${item2.range.unit} exceeds the allowed maximum of ${item2.range.max}.`;
  }
  if (trimmed === "") return "No value configured.";
  return `${trimmed} does not match the baseline value (${item2.recommended}).`;
}
function findingIdFor(deviceId, configItemId) {
  return `${deviceId}::${configItemId}`;
}
function findingsForDevice(device2) {
  const items = materialiseConfig(device2);
  const findings = [];
  for (const item2 of items) {
    if (isValueCompliant(item2, item2.value)) continue;
    const { reason } = complianceVerdict(item2, item2.value);
    findings.push({
      id: findingIdFor(device2.id, item2.id),
      deviceId: device2.id,
      configItemId: item2.id,
      severity: item2.severity,
      title: item2.finding.title,
      issueCategory: item2.finding.issueCategory,
      description: `${item2.label} on ${device2.name} is set to \u201C${item2.value}\u201D. ${reason}`,
      why: item2.finding.why,
      fix: item2.finding.fix,
      reference: item2.finding.reference,
      currentValue: item2.value,
      recommendedValue: item2.recommended,
      status: "open",
      detectedAt: device2.lastScan
    });
  }
  return sortFindings(findings);
}
function findingRegister(devices, changes) {
  const open = devices.flatMap(findingsForDevice);
  const remediated = /* @__PURE__ */ new Map();
  for (const change of changes) {
    if (change.changeStatus !== "applied" || change.validationStatus !== "validated") continue;
    remediated.set(findingIdFor(change.deviceId, change.configItemId), change);
  }
  const openIds = new Set(open.map((finding) => finding.id));
  const resolved = [];
  for (const [id, change] of remediated) {
    if (openIds.has(id)) continue;
    const [deviceId, configItemId] = id.split("::");
    const device2 = devices.find((candidate) => candidate.id === deviceId);
    const def = CONFIG_BY_ID[configItemId];
    if (!device2 || !def) continue;
    if (isValueCompliant(def, change.oldValue)) continue;
    resolved.push({
      id,
      deviceId,
      configItemId,
      severity: def.severity,
      title: def.finding.title,
      issueCategory: def.finding.issueCategory,
      description: `${def.label} on ${device2.name} was changed from \u201C${change.oldValue}\u201D to \u201C${change.newValue}\u201D and now matches the CyberSure baseline.`,
      why: def.finding.why,
      fix: def.finding.fix,
      reference: def.finding.reference,
      currentValue: change.newValue,
      recommendedValue: def.recommended,
      status: "resolved",
      detectedAt: change.timestamp,
      resolvedAt: change.timestamp,
      resolvedByChangeId: change.id
    });
  }
  return sortFindings([...open, ...resolved]);
}
function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    const severityDelta = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (severityDelta !== 0) return severityDelta;
    return a.title.localeCompare(b.title);
  });
}
function postureFor(findings) {
  const penalty = openFindingPenalty(findings);
  return clampScore(100 - penalty * DEVICE_POSTURE_SCALE);
}
function openFindingPenalty(findings) {
  return findings.filter((finding) => finding.status === "open").reduce((total, finding) => total + SEVERITY_WEIGHT[finding.severity], 0);
}
function estatePosture(perDevice) {
  const scores = Object.values(perDevice);
  if (scores.length === 0) return 100;
  return clampScore(scores.reduce((total, score) => total + score, 0) / scores.length);
}
function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
function severityBreakdown(findings) {
  const breakdown = { critical: 0, high: 0, medium: 0, low: 0, open: 0, resolved: 0 };
  for (const finding of findings) {
    if (finding.status === "resolved") {
      breakdown.resolved += 1;
      continue;
    }
    breakdown.open += 1;
    breakdown[finding.severity] += 1;
  }
  return breakdown;
}
function securityStatusFor(findings) {
  const open = findings.filter((finding) => finding.status === "open");
  if (open.length === 0) return "compliant";
  for (const severity of SEVERITY_ORDER) {
    if (open.some((finding) => finding.severity === severity)) return severity;
  }
  return "compliant";
}
function complianceFor(devices, findings) {
  const results = [];
  for (const device2 of devices) {
    for (const check of COMPLIANCE_CHECKS) {
      const status = check.evaluate(device2.config.values);
      if (status === "na") {
        results.push({
          checkId: check.id,
          deviceId: device2.id,
          status: "na",
          currentState: "Not applicable to this device type",
          severity: check.severity
        });
        continue;
      }
      const related = findings.find(
        (finding) => finding.status === "open" && finding.deviceId === device2.id && check.inspects.includes(finding.configItemId)
      );
      results.push({
        checkId: check.id,
        deviceId: device2.id,
        status,
        currentState: check.currentState(device2.config.values),
        severity: check.severity,
        findingId: related?.id
      });
    }
  }
  const frameworks = ["cis", "iso27001", "nist"].map((frameworkId) => {
    const applicable = results.filter(
      (result) => COMPLIANCE_CHECKS.some(
        (check) => check.id === result.checkId && check.frameworks.includes(frameworkId)
      )
    );
    let score = 100;
    let totalWeight = 0;
    let penalty = 0;
    for (const result of applicable) {
      const check = COMPLIANCE_CHECKS.find((candidate) => candidate.id === result.checkId);
      totalWeight += check.weight;
      if (result.status === "fail") penalty += check.weight * CONTROL_SEVERITY_WEIGHT[result.severity];
    }
    if (totalWeight > 0) {
      score = clampScore(100 - penalty / totalWeight * 100);
    }
    return {
      id: frameworkId,
      score,
      passed: applicable.filter((result) => result.status === "pass").length,
      failed: applicable.filter((result) => result.status === "fail").length,
      na: applicable.filter((result) => result.status === "na").length
    };
  });
  const weightedTotal = frameworks.reduce((total, framework) => total + framework.score, 0);
  const overall = clampScore(weightedTotal / frameworks.length);
  return { overall, frameworks, results };
}
function analyse(devices, changes) {
  const findings = findingRegister(devices, changes);
  const itemsByDevice = {};
  const findingsByDevice = {};
  const securityStatusByDevice = {};
  const postureByDevice = {};
  for (const device2 of devices) {
    itemsByDevice[device2.id] = materialiseConfig(device2);
    const deviceFindings = findings.filter((finding) => finding.deviceId === device2.id);
    findingsByDevice[device2.id] = deviceFindings;
    securityStatusByDevice[device2.id] = securityStatusFor(deviceFindings);
    postureByDevice[device2.id] = postureFor(deviceFindings);
  }
  return {
    devices,
    findings,
    itemsByDevice,
    findingsByDevice,
    securityStatusByDevice,
    postureByDevice,
    posture: estatePosture(postureByDevice),
    breakdown: severityBreakdown(findings),
    compliance: complianceFor(devices, findings)
  };
}
function deviceComplianceStatus(device2, findings) {
  const controls = COMPLIANCE_CHECKS.filter((check) => check.inspects.some((id) => id in device2.config.values));
  if (controls.length === 0) return "not-assessed";
  const failed = controls.filter((check) => check.evaluate(device2.config.values) === "fail");
  if (failed.length === 0) return "compliant";
  const openFindings = findings.filter(
    (finding) => finding.status === "open" && finding.deviceId === device2.id
  );
  if (openFindings.some((finding) => finding.severity === "critical" || finding.severity === "high")) {
    return "non-compliant";
  }
  const passedRatio = (controls.length - failed.length) / controls.length;
  return passedRatio >= 0.8 ? "partial" : "non-compliant";
}

// src/utils/validators.ts
var IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
var CIDR = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/([0-9]|[12][0-9]|3[0-2])$/;
var HOSTNAME = /^(?=.{1,253}$)([a-zA-Z0-9](-*[a-zA-Z0-9])*)(\.[a-zA-Z0-9](-*[a-zA-Z0-9])*)*$/;
function isIPv4(value) {
  return IPV4.test(value.trim());
}
function isCidr(value) {
  return CIDR.test(value.trim());
}
function isPort(value) {
  if (!/^\d+$/.test(value.trim())) return false;
  const port = Number(value.trim());
  return port >= 1 && port <= 65535;
}
function isInteger(value) {
  return /^-?\d+$/.test(value.trim());
}
function splitList(value) {
  return value.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}
function normaliseValue(item2, raw) {
  const trimmed = raw.trim();
  if (item2.type === "list") {
    return splitList(trimmed).join(", ");
  }
  if (item2.type === "number" || item2.type === "port") {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? String(parsed) : trimmed;
  }
  return trimmed;
}
function validateSyntax(item2, raw) {
  const value = raw.trim();
  if (value.length === 0 && item2.type !== "list") {
    return { ok: false, message: "A value is required for this setting." };
  }
  switch (item2.type) {
    case "toggle": {
      const allowed = (item2.options ?? []).map((option) => option.value);
      if (allowed.length > 0 && !allowed.includes(value)) {
        return { ok: false, message: `Value must be one of: ${allowed.join(", ")}.` };
      }
      return { ok: true, message: `Boolean setting accepted (${value}).` };
    }
    case "select":
    case "action": {
      const allowed = (item2.options ?? []).map((option) => option.value);
      if (!allowed.includes(value)) {
        return {
          ok: false,
          message: `"${value}" is not a valid option for ${item2.setting}. Expected one of: ${allowed.join(", ")}.`
        };
      }
      return { ok: true, message: `Selected an enumerated value defined for ${item2.setting}.` };
    }
    case "port": {
      if (!isPort(value)) return { ok: false, message: "Enter a valid TCP/UDP port between 1 and 65535." };
      return { ok: true, message: `Port ${value} is within the valid range 1-65535.` };
    }
    case "number": {
      if (!isInteger(value)) return { ok: false, message: "Enter a whole number (digits only)." };
      const parsed = Number(value);
      if (item2.range && (parsed < item2.range.min || parsed > item2.range.max)) {
        return {
          ok: false,
          message: `Enter a value between ${item2.range.min} and ${item2.range.max} ${item2.range.unit}.`
        };
      }
      if (parsed < 0) return { ok: false, message: "Value cannot be negative." };
      return { ok: true, message: `Numeric value ${value} accepted.` };
    }
    case "ip": {
      if (!isIPv4(value)) return { ok: false, message: "Enter a valid IPv4 address, for example 10.0.0.1." };
      return { ok: true, message: `IPv4 address ${value} is well formed.` };
    }
    case "cidr": {
      if (isIPv4(value) || isCidr(value)) {
        return { ok: true, message: `Address ${value} is well formed.` };
      }
      return { ok: false, message: "Enter a valid IPv4 address or CIDR range, for example 10.10.0.0/16." };
    }
    case "list": {
      const entries = splitList(value);
      if (entries.length === 0) {
        return { ok: false, message: "Enter at least one entry (comma separated)." };
      }
      for (const entry of entries) {
        if (!isIPv4(entry) && !isCidr(entry) && !HOSTNAME.test(entry)) {
          return {
            ok: false,
            message: `"${entry}" is not a valid entry. Use IPv4 addresses, CIDR ranges or hostnames.`
          };
        }
      }
      return { ok: true, message: `${entries.length} valid entr${entries.length === 1 ? "y" : "ies"} parsed.` };
    }
    case "text":
    default: {
      if (value.length > 120) return { ok: false, message: "Value must be 120 characters or fewer." };
      return { ok: true, message: "Text value accepted." };
    }
  }
}
function worstStatus(statuses) {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  if (statuses.includes("pass")) return "pass";
  return "na";
}

// src/lib/validation.ts
var denyValue = (settings, denied, reason) => ({
  id: "POL",
  name: "no-cleartext",
  settings,
  evaluate: (item2, value) => denied.includes(value) ? { status: "fail", detail: `${item2.setting} = ${value} is prohibited. ${reason}` } : { status: "pass", detail: `${item2.setting} = ${value} satisfies the security policy.` }
});
var SECURITY_POLICIES = [
  {
    id: "CS-POL-01",
    name: "No cleartext management protocols",
    settings: ["mgmt.telnet", "mgmt.http"],
    evaluate: (item2, value) => value === "Disabled" ? { status: "pass", detail: `${item2.setting} is disabled \u2014 cleartext management is not permitted.` } : {
      status: "fail",
      detail: `${item2.setting} = ${value} is prohibited. Cleartext management protocols must be disabled.`
    }
  },
  {
    id: "CS-POL-02",
    name: "Encrypted SSH channel required",
    settings: ["mgmt.ssh"],
    evaluate: (_item, value) => value === "Enabled" ? { status: "pass", detail: "SSHv2 is enabled for remote administration." } : { status: "fail", detail: "Disabling SSH removes the encrypted administrative channel required by policy." }
  },
  {
    id: "CS-POL-03",
    name: "Management access restricted to trusted sources",
    settings: ["mgmt.mgmtAcl"],
    evaluate: (_item, value) => {
      const unrestricted = value.includes("0.0.0.0/0") || value.trim() === "any";
      return unrestricted ? { status: "fail", detail: "A 0.0.0.0/0 management ACL is prohibited \u2014 the management plane must be restricted." } : { status: "pass", detail: "Management ACL is limited to the approved subnets." };
    }
  },
  {
    id: "CS-POL-04",
    name: "Strong credential policy",
    settings: ["auth.passwordPolicy"],
    evaluate: (item2, value) => value === "Strong" ? { status: "pass", detail: "Strong password policy enforced." } : { status: "fail", detail: `${item2.setting} = ${value} is below the mandatory Strong policy.` }
  },
  {
    id: "CS-POL-05",
    name: "Multi-factor authentication for administrators",
    settings: ["auth.mfa"],
    evaluate: (_item, value) => value === "Enabled" ? { status: "pass", detail: "MFA enforced for privileged logins." } : { status: "fail", detail: "Privileged logins must require a second factor." }
  },
  {
    id: "CS-POL-06",
    name: "No cleartext file transfer",
    settings: ["svc.ftp", "svc.tftp"],
    evaluate: (item2, value) => value === "Disabled" ? { status: "pass", detail: `${item2.setting} is disabled \u2014 file transfer must use SFTP.` } : { status: "fail", detail: `${item2.setting} = ${value} transmits data without encryption and is prohibited.` }
  },
  {
    id: "CS-POL-07",
    name: "Perimeter default-deny posture",
    settings: ["fw.defaultInbound", "fw.intraZonePolicy"],
    evaluate: (item2, value) => value === "DENY" ? { status: "pass", detail: `${item2.setting} = DENY matches the default-deny baseline.` } : { status: "fail", detail: `${item2.setting} = ${value} permits unmatched traffic and violates the default-deny baseline.` }
  },
  {
    id: "CS-POL-08",
    name: "No permit any / permit any rules",
    settings: ["fw.anyAnyRule"],
    evaluate: (_item, value) => value === "Disabled" ? { status: "pass", detail: "No any/any rule is present in the rule base." } : { status: "fail", detail: "A permit any/permit any rule bypasses the entire rule base and is prohibited." }
  },
  {
    id: "CS-POL-09",
    name: "Audit logging required",
    settings: ["log.configChanges", "log.firewall"],
    evaluate: (item2, value) => value === "Enabled" ? { status: "pass", detail: `${item2.label} is enabled \u2014 the audit trail is intact.` } : { status: "fail", detail: `${item2.label} is mandatory for the audit trail and must stay enabled.` }
  },
  {
    id: "CS-POL-10",
    name: "Approved cryptography only",
    settings: ["enc.sshCipher", "enc.tlsVersion", "enc.ikePolicy", "enc.wifiCipher", "enc.passwordStorage"],
    evaluate: (item2, value) => isValueCompliant(item2, value) ? { status: "pass", detail: `${value} is an approved cryptographic value.` } : { status: "fail", detail: `${value} is not an approved cryptographic value for ${item2.setting}.` }
  },
  {
    id: "CS-POL-11",
    name: "SNMP hardening",
    settings: ["svc.snmpVersion"],
    evaluate: (_item, value) => value === "v3" || value === "Disabled" ? { status: "pass", detail: "SNMP is hardened (v3) or disabled." } : { status: "fail", detail: "SNMPv1/v2c community strings are sent in clear text and are prohibited." }
  },
  {
    id: "CS-POL-12",
    name: "Approved DNS resolvers only",
    settings: ["sys.dnsServers"],
    evaluate: (_item, value) => {
      const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
      const external = entries.filter(
        (entry) => !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry)
      );
      return external.length > 0 ? { status: "fail", detail: `External resolver(s) detected: ${external.join(", ")}.` } : { status: "pass", detail: "All resolvers are approved internal addresses." };
    }
  },
  {
    id: "CS-POL-13",
    name: "Least functionality",
    settings: ["svc.unusedServices"],
    evaluate: (_item, value) => {
      const count = Number(value);
      if (!Number.isFinite(count) || count <= 0) {
        return { status: "pass", detail: "No unused network services detected." };
      }
      return {
        status: "warn",
        detail: `${count} unused service(s) still reported. Acceptable with a documented exception, otherwise remediate.`
      };
    }
  },
  {
    id: "CS-POL-14",
    name: "Firmware in vendor support",
    settings: ["sys.firmwareSupport"],
    evaluate: (_item, value) => value === "Supported" ? { status: "pass", detail: "Firmware release is still in vendor support." } : {
      status: "warn",
      detail: `${value} firmware. Acceptable only under a documented, time-boxed upgrade plan.`
    }
  },
  denyValue(["auth.lockout"], ["Disabled"], "Unlimited password guessing against the management plane is not permitted."),
  denyValue(["log.remoteSyslog"], ["Disabled"], "Logs must be exported to the central collector."),
  denyValue(["auth.sharedAccounts"], ["Present", "Enabled"], "Every change must be attributable to a named account."),
  denyValue(["sys.backupSchedule"], ["Manual"], "Configuration baselines must be archived on a schedule."),
  denyValue(["fw.managementZone"], ["Disabled"], "The management plane must be isolated from user zones."),
  {
    id: "CS-POL-20",
    name: "Short privileged session timeout",
    settings: ["mgmt.consoleTimeout"],
    evaluate: (_item, value) => {
      const minutes = Number(value);
      if (!Number.isFinite(minutes) || minutes <= 0) return { status: "fail", detail: "Enter a positive timeout." };
      if (minutes <= 15) return { status: "pass", detail: `Console timeout of ${minutes} minutes is acceptable.` };
      if (minutes <= 30) {
        return { status: "warn", detail: `${minutes} minutes is above the 15 minute baseline but still bounded.` };
      }
      return { status: "fail", detail: `${minutes} minutes leaves privileged sessions unattended for too long.` };
    }
  }
];
function toStageStatus(status) {
  return status === "na" ? "pending" : status;
}
function aggregateStageStatus(statuses, { applicable, syntaxOk }) {
  if (!syntaxOk) return "pending";
  if (!applicable) return "pass";
  return toStageStatus(worstStatus(statuses));
}
function policiesFor(item2) {
  return SECURITY_POLICIES.filter((policy) => policy.settings.includes(item2.id));
}
function controlsFor(item2) {
  return COMPLIANCE_CHECKS.filter((check) => check.inspects.includes(item2.id));
}
function conflictChecks(item2, value, values) {
  const out = [];
  const enabled = (key) => values[key] === "Enabled";
  const disabled = (key) => values[key] === "Disabled";
  if (item2.id === "mgmt.ssh" && value === "Disabled" && disabled("mgmt.telnet") && disabled("mgmt.http")) {
    out.push({
      status: "fail",
      detail: "This change removes every remote administration path \u2014 SSH, Telnet and HTTP management are all disabled."
    });
  }
  if (item2.id === "mgmt.https" && value === "Disabled" && disabled("mgmt.http") && disabled("mgmt.ssh")) {
    out.push({
      status: "fail",
      detail: "The web management interface and SSH are both unavailable \u2014 local console would be the only access path."
    });
  }
  if (item2.id === "mgmt.http" && value === "Enabled" && enabled("mgmt.https")) {
    out.push({
      status: "warn",
      detail: "Two web management listeners will be active. Operators may silently fall back to the unencrypted one."
    });
  }
  if (item2.id === "mgmt.mgmtAcl" && (value.includes("0.0.0.0/0") || value.trim() === "any") && disabled("auth.mfa")) {
    out.push({
      status: "warn",
      detail: "Management access would be open to every source while MFA is disabled on this device."
    });
  }
  if (item2.id === "log.firewall" && value === "Disabled" && values["fw.defaultInbound"] === "ALLOW") {
    out.push({
      status: "warn",
      detail: "Unmatched inbound traffic is permitted on this device but would no longer be logged."
    });
  }
  if (item2.id === "fw.anyAnyRule" && value === "Enabled" && values["fw.defaultInbound"] === "DENY") {
    out.push({
      status: "warn",
      detail: "An any/any rule makes the default-deny posture ineffective for every zone it spans."
    });
  }
  if (item2.id === "fw.defaultInbound" && value === "ALLOW" && disabled("log.firewall")) {
    out.push({
      status: "warn",
      detail: "A permissive inbound default combined with disabled session logging removes both control and visibility."
    });
  }
  if (item2.id === "auth.mfa" && value === "Enabled" && disabled("auth.lockout")) {
    out.push({
      status: "warn",
      detail: "MFA will be enforced before account lockout, so repeated factor guessing will not be throttled."
    });
  }
  if (item2.id === "svc.snmpVersion" && value === "Disabled" && disabled("log.remoteSyslog")) {
    out.push({
      status: "warn",
      detail: "With SNMP and remote syslog both disabled, this device reports no telemetry to the monitoring platform."
    });
  }
  if (item2.id === "sys.ntpSync" && value === "Disabled" && enabled("log.configChanges")) {
    out.push({
      status: "warn",
      detail: "Configuration change logs will carry unreliable timestamps, breaking forensic correlation."
    });
  }
  if (item2.id === "enc.tlsVersion" && (value === "SSLv3" || value === "TLS 1.0") && enabled("mgmt.https")) {
    out.push({
      status: "warn",
      detail: "The HTTPS management interface stays enabled and would negotiate a deprecated TLS version."
    });
  }
  if (item2.id === "enc.passwordStorage" && value !== "Plaintext" && !enabled("log.configChanges")) {
    out.push({
      status: "warn",
      detail: "Rotating stored credentials should be recorded, but configuration change logging is disabled."
    });
  }
  if (item2.id === "mgmt.telnet" && value === "Enabled" && disabled("auth.mfa")) {
    out.push({
      status: "warn",
      detail: "Telnet would expose cleartext credentials on a device without multi-factor authentication."
    });
  }
  if (item2.id === "auth.passwordPolicy" && value === "Strong" && enabled("auth.sharedAccounts")) {
    out.push({
      status: "warn",
      detail: "A strong policy cannot be enforced per person while shared administrative accounts exist."
    });
  }
  return out;
}
function validateChange({ device: device2, item: item2, rawValue, now }) {
  const value = normaliseValue(item2, rawValue);
  const validatedAt = now ?? (/* @__PURE__ */ new Date()).toISOString();
  const stages = [];
  const syntax = validateSyntax(item2, rawValue);
  stages.push({
    id: "syntax",
    label: "Syntax validation",
    detail: syntax.ok ? `Parsed \u201C${value}\u201D as ${item2.type} for ${item2.label}.` : "The proposed value is not syntactically valid.",
    status: syntax.ok ? "pass" : "fail",
    messages: [syntax.message]
  });
  const policies = policiesFor(item2);
  const policyVerdicts = syntax.ok && policies.length > 0 ? policies.map((policy) => ({ policy, verdict: policy.evaluate(item2, value) })) : [];
  const policyStatus = aggregateStageStatus(
    policyVerdicts.map((entry) => entry.verdict.status),
    { applicable: policyVerdicts.length > 0, syntaxOk: syntax.ok }
  );
  stages.push({
    id: "policy",
    label: "Security policy validation",
    detail: !syntax.ok ? "Skipped \u2014 the syntax check did not pass." : policies.length === 0 ? "No CyberSure security policy constrains this setting \u2014 baseline comparison applies." : policyStatus === "pass" ? `Checked against ${policyVerdicts.length} CyberSure security polic${policyVerdicts.length === 1 ? "y" : "ies"}.` : policyStatus === "warn" ? "Compliant with policy, with advisory notes." : "The proposed value violates an active security policy.",
    status: policyStatus,
    messages: !syntax.ok ? ["Not evaluated \u2014 fix the syntax error first."] : policyVerdicts.length > 0 ? policyVerdicts.map((entry) => `[${entry.policy.id}] ${entry.verdict.detail}`) : ["No active security policy constrains this setting. Baseline comparison applies."]
  });
  const controls = controlsFor(item2);
  const hypothetical = { ...device2.config.values, [item2.id]: value };
  const complianceEntries = syntax.ok ? controls.map((check) => {
    const before = check.evaluate(device2.config.values);
    const after2 = check.evaluate(hypothetical);
    return { check, before, after: after2 };
  }) : [];
  const complianceStatus = aggregateStageStatus(
    complianceEntries.map((entry) => entry.after),
    { applicable: complianceEntries.length > 0, syntaxOk: syntax.ok }
  );
  const improved = complianceEntries.filter(
    (entry) => entry.before === "fail" && entry.after === "pass"
  );
  const regressed = complianceEntries.filter(
    (entry) => entry.before === "pass" && entry.after === "fail"
  );
  stages.push({
    id: "compliance",
    label: "Compliance validation",
    detail: !syntax.ok ? "Skipped \u2014 the syntax check did not pass." : improved.length > 0 ? `Restores ${improved.length} failing compliance control${improved.length === 1 ? "" : "s"}.` : regressed.length > 0 ? `Would break ${regressed.length} currently passing compliance control${regressed.length === 1 ? "" : "s"}.` : complianceEntries.length === 0 ? "This setting is not mapped to a demo compliance control." : `Evaluated against ${complianceEntries.length} mapped compliance control${complianceEntries.length === 1 ? "" : "s"}.`,
    status: complianceStatus,
    messages: syntax.ok ? complianceEntries.length > 0 ? complianceEntries.map((entry) => {
      const label = entry.check.frameworks.map((framework) => framework.toUpperCase()).join("/");
      const verdict = entry.after === "pass" ? "PASS" : "FAIL";
      return `[${entry.check.id}] ${verdict} \u2014 ${entry.check.name} (${label})`;
    }) : ["This setting is not mapped to a demo compliance control."] : ["Not evaluated \u2014 fix the syntax error first."]
  });
  const conflicts = syntax.ok ? conflictChecks(item2, value, hypothetical) : [];
  const conflictStatus = aggregateStageStatus(
    conflicts.map((entry) => entry.status),
    { applicable: conflicts.length > 0, syntaxOk: syntax.ok }
  );
  const unchanged = value === (device2.config.values[item2.id] ?? item2.value);
  stages.push({
    id: "conflict",
    label: "Configuration conflict check",
    detail: !syntax.ok ? "Skipped \u2014 the syntax check did not pass." : unchanged ? "The proposed value is identical to the current value; no state change will occur." : conflicts.length === 0 ? "No conflicts detected against the rest of the device configuration." : `${conflicts.length} interaction${conflicts.length === 1 ? "" : "s"} detected with the current configuration.`,
    status: !syntax.ok ? "pending" : unchanged ? "warn" : conflictStatus,
    messages: !syntax.ok ? ["Not evaluated \u2014 fix the syntax error first."] : unchanged ? ["Proposed value matches the current value. Pick a different value to record a change."] : conflicts.length > 0 ? conflicts.map((entry) => entry.detail) : [`Cross-checked ${Object.keys(hypothetical).length} settings on ${device2.name}.`]
  });
  const blocking = stages.filter((stage) => stage.status === "fail").flatMap((stage) => stage.messages);
  const advisories = stages.filter((stage) => stage.status === "warn").flatMap((stage) => stage.messages);
  return {
    valid: blocking.length === 0,
    stages,
    blocking: [...new Set(blocking)],
    advisories: [...new Set(advisories)],
    proposedValue: value,
    validatedAt
  };
}
function validateDevice(device2, now) {
  const items = materialiseConfig(device2);
  const deviations = items.filter((item2) => !isValueCompliant(item2, item2.value));
  const blockingSyntax = deviations.filter((item2) => validateSyntax(item2, item2.value).ok === false);
  const checks = [
    {
      label: `Configuration syntax (${items.length} settings)`,
      status: blockingSyntax.length === 0 ? "pass" : "fail",
      detail: blockingSyntax.length === 0 ? `All ${items.length} settings parsed successfully.` : `${blockingSyntax.length} setting(s) could not be parsed.`
    },
    {
      label: "Security policy compliance",
      status: deviations.length === 0 ? "pass" : deviations.some((item2) => item2.severity === "critical" || item2.severity === "high") ? "fail" : "warn",
      detail: deviations.length === 0 ? "Every setting matches the CyberSure baseline." : `${deviations.length} setting(s) deviate from the baseline (${deviations.map((item2) => item2.setting).join(", ")}).`
    },
    {
      label: "Management access paths",
      status: device2.config.values["mgmt.ssh"] === "Enabled" || device2.config.values["mgmt.https"] === "Enabled" ? "pass" : "fail",
      detail: device2.config.values["mgmt.ssh"] === "Enabled" || device2.config.values["mgmt.https"] === "Enabled" ? "At least one encrypted management path is available." : "No encrypted management path remains on this device."
    },
    {
      label: "Referenced configuration items",
      status: "pass",
      detail: `${items.filter((item2) => item2.complianceRefs.length > 0).length} settings are mapped to demo compliance controls.`
    }
  ];
  return {
    deviceId: device2.id,
    deviceName: device2.name,
    violations: deviations.length,
    checks,
    valid: checks.every((check) => check.status === "pass"),
    checkedAt: now ?? (/* @__PURE__ */ new Date()).toISOString()
  };
}

// scripts/verify.ts
var analysis = analyse(seedDevices, seedChanges);
console.log("=== CyberSure demo engine verification ===\n");
console.log("Devices:", seedDevices.length);
console.log("Security posture:", analysis.posture, "/ 100");
console.log("Open findings:", analysis.breakdown.open);
console.log("  critical:", analysis.breakdown.critical);
console.log("  high    :", analysis.breakdown.high);
console.log("  medium  :", analysis.breakdown.medium);
console.log("  low     :", analysis.breakdown.low);
console.log("Resolved (audit trail):", analysis.breakdown.resolved);
console.log("Overall compliance:", analysis.compliance.overall + "%");
for (const framework of analysis.compliance.frameworks) {
  console.log(`  ${framework.id.padEnd(10)} ${framework.score}%  (pass ${framework.passed} / fail ${framework.failed} / na ${framework.na})`);
}
var compliant = seedDevices.filter(
  (device2) => (analysis.securityStatusByDevice[device2.id] ?? "compliant") === "compliant"
);
console.log("\nFully compliant devices:", compliant.map((device2) => device2.name).join(", ") || "none");
console.log("\n--- Device status ---");
for (const device2 of seedDevices) {
  const findings = analysis.findingsByDevice[device2.id] ?? [];
  const open = findings.filter((finding) => finding.status === "open");
  console.log(
    `${device2.name.padEnd(24)} ${String(analysis.postureByDevice[device2.id]).padStart(3)}/100  ${(analysis.securityStatusByDevice[device2.id] ?? "").padEnd(9)} compliance=${deviceComplianceStatus(device2, findings).padEnd(13)} open=${open.length}`
  );
  for (const finding of open) {
    console.log(`    [${finding.severity.toUpperCase().padEnd(8)}] ${finding.configItemId} = ${finding.currentValue} -> ${finding.recommendedValue}`);
  }
}
console.log("\n=== CORE WORKFLOW: Telnet remediation on Core-Router-01 ===\n");
var device = seedDevices[0];
var item = { ...CONFIG_BY_ID["mgmt.telnet"], value: device.config.values["mgmt.telnet"] };
console.log("Setting:", item.setting, "| current:", item.value, "| recommended:", item.recommended);
var bad = validateChange({ device, item, rawValue: "Enabled" });
console.log('\nProposal "Enabled" (already current / insecure):');
console.log("  valid:", bad.valid);
console.log("  stages:", bad.stages.map((stage) => `${stage.id}=${stage.status}`).join(" "));
console.log("  blocking:", bad.blocking);
var badSyntax = validateChange({ device: seedDevices[1], item: { ...CONFIG_BY_ID["mgmt.mgmtAcl"], value: "0.0.0.0/0" }, rawValue: "not an ip,9999" });
console.log('\nProposal "not an ip,9999" for Mgmt ACL:');
console.log("  valid:", badSyntax.valid, "| stage syntax =", badSyntax.stages[0].status);
console.log("  message:", badSyntax.stages[0].messages[0]);
var good = validateChange({ device, item, rawValue: "Disabled" });
console.log('\nProposal "Disabled" (the remediation):');
console.log("  valid:", good.valid);
for (const stage of good.stages) {
  console.log(`  - ${stage.label}: ${stage.status} \u2014 ${stage.detail}`);
  for (const message of stage.messages) console.log(`      ${message}`);
}
console.log("  advisories:", good.advisories);
var hardened = seedDevices.find((candidate) => candidate.id === "dev-access-switch-01");
var sshItem = { ...CONFIG_BY_ID["mgmt.ssh"], value: hardened.config.values["mgmt.ssh"] };
console.log(
  `
Conflict demo on ${hardened.name}: telnet=${hardened.config.values["mgmt.telnet"]} http=${hardened.config.values["mgmt.http"]} -> disable SSH`
);
var conflict = validateChange({ device: hardened, item: sshItem, rawValue: "Disabled" });
console.log("  valid:", conflict.valid, "| conflict stage =", conflict.stages[3].status);
console.log("  blocking:", conflict.blocking);
var dmz = seedDevices.find((candidate) => candidate.id === "dev-dmz-web-fw-01");
var backupItem = { ...CONFIG_BY_ID["sys.backupSchedule"], value: dmz.config.values["sys.backupSchedule"] };
var advisory = validateChange({ device: dmz, item: backupItem, rawValue: "Weekly" });
console.log(`
Advisory demo on ${dmz.name}: config backup Weekly`);
console.log("  valid:", advisory.valid, "| policy stage =", advisory.stages[1].status);
console.log("  advisories:", advisory.advisories);
console.log("\n=== Whole-device validation ===");
for (const target of [seedDevices[0], seedDevices[2]]) {
  const report = validateDevice(target);
  console.log(
    `${target.name}: valid=${report.valid} violations=${report.violations}`
  );
  for (const check of report.checks) console.log(`   - [${check.status}] ${check.label}: ${check.detail}`);
}
var simulated = seedDevices.map(
  (candidate) => candidate.id === device.id ? { ...candidate, config: { ...candidate.config, values: { ...candidate.config.values, "mgmt.telnet": "Disabled" } } } : candidate
);
var nextChanges = [
  {
    id: "CHG-008",
    deviceId: device.id,
    deviceName: device.name,
    configItemId: "mgmt.telnet",
    setting: "Telnet",
    category: item.category,
    oldValue: "Enabled",
    newValue: "Disabled",
    recommended: "Disabled",
    validationStatus: "validated",
    changeStatus: "applied",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    actor: "demo.operator",
    source: "remediation"
  },
  ...seedChanges
];
var after = analyse(simulated, nextChanges);
var resolvedTelnet = after.findings.find(
  (finding) => finding.configItemId === "mgmt.telnet" && finding.deviceId === device.id
);
console.log("\n=== After applying the demo change ===");
console.log("Posture:", analysis.posture, "->", after.posture);
console.log("Open findings:", analysis.breakdown.open, "->", after.breakdown.open);
console.log("Telnet finding status:", resolvedTelnet?.status, "| resolved by", resolvedTelnet?.resolvedByChangeId);
console.log("Change recorded as:", nextChanges[0].id);
console.log("\n=== Compliance delta ===");
console.log("Overall:", analysis.compliance.overall, "->", after.compliance.overall);
var control = after.compliance.results.filter(
  (result) => result.deviceId === device.id && result.checkId === "no-telnet"
);
console.log("no-telnet control for Core-Router-01:", control.map((result) => result.status).join(","));
var schemaErrors = 0;
for (const candidate of seedDevices) {
  for (const [key, value] of Object.entries(candidate.config.values)) {
    const def = CONFIG_BY_ID[key];
    if (!def) {
      console.log("UNKNOWN SETTING", key, "on", candidate.name);
      schemaErrors += 1;
      continue;
    }
    if (!def.deviceTypes.includes(candidate.type)) {
      console.log("TYPE MISMATCH", key, "on", candidate.name);
      schemaErrors += 1;
    }
    if (def.type === "select" && def.options && !def.options.some((option) => option.value === value)) {
      console.log("INVALID VALUE", key, "=", value, "on", candidate.name);
      schemaErrors += 1;
    }
  }
}
console.log("\nSchema consistency errors:", schemaErrors);
console.log("isValueCompliant sanity:", isValueCompliant(CONFIG_BY_ID["mgmt.telnet"], "Enabled"), isValueCompliant(CONFIG_BY_ID["mgmt.telnet"], "Disabled"));
