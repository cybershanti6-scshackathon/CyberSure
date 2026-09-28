import type { PlatformId } from '@/types';

/* =============================================================================
 * Configuration samples
 * -----------------------------------------------------------------------------
 * These are hand-authored, fictional configurations used to demonstrate the
 * Configuration Converter. Nothing here was collected from a live device and
 * nothing is ever pushed to one.
 * ========================================================================== */

export interface ConfigSample {
  id: string;
  name: string;
  description: string;
  config: string;
}

const CISCO_IOSXE_CORE = `!
! CYBERSURE CONFIGURATION
! Hand-authored for the prototype. Not collected from a live device.
!
hostname Router1
!
ip domain-name example.com
!
ip ssh version 2
!
interface GigabitEthernet0/1
 description Uplink to ISP
 ip address 192.168.1.1 255.255.255.0
 no shutdown
!
end
`;

const CISCO_IOSXE_EDGE = `!
! CYBERSURE CONFIGURATION
! Extended sample: an edge router with logging, NTP and management policy.
!
hostname Edge-Router-01
!
ip domain-name example.com
!
ip ssh version 2
!
interface GigabitEthernet0/1
 description Uplink to ISP
 ip address 192.168.1.1 255.255.255.0
 mtu 1500
 no shutdown
!
interface GigabitEthernet0/2
 description LAN to Access-Switch-01
 ip address 10.0.0.1 255.255.255.0
 no shutdown
!
interface GigabitEthernet0/3
 description Branch overlay
 ip address 10.10.0.1 255.255.255.252
 no shutdown
!
logging host 10.0.10.50
logging buffered 32768 informational
!
ntp server 10.0.10.60
!
banner motd ^C
Authorised access only. All activity is logged.
^C
!
ip route 0.0.0.0 0.0.0.0 192.168.1.254
!
line vty 0 4
 transport input ssh
!
end
`;

const CISCO_IOS_LEGACY = `!
version 15.7
!
hostname Legacy-Router-01
!
ip domain-name example.com
!
ip ssh version 2
!
service password-encryption
!
interface GigabitEthernet0/0
 description Branch uplink
 ip address 172.16.4.1 255.255.255.0
 no shutdown
!
logging host 10.0.10.50
!
line vty 0 4
 transport input ssh
!
end
`;

const JUNOS_SET = `# CYBERSURE CONFIGURATION
set system host-name Router1
set system domain-name example.com
set system services ssh protocol-version v2
set interfaces ge-0/0/1 description "Uplink to ISP"
set interfaces ge-0/0/1 unit 0 family inet address 192.168.1.1/24
set interfaces ge-0/0/2 description "LAN to Access-Switch-01"
set interfaces ge-0/0/2 unit 0 family inet address 10.0.0.1/24
set system syslog host 10.0.10.50
set system ntp server 10.0.10.60
set system commit
`;

const JUNOS_BLOCKS = `# CYBERSURE CONFIGURATION
system {
    host-name Router1;
    domain-name example.com;
    services {
        ssh {
            protocol-version v2;
        }
    }
    syslog {
        host 10.0.10.50;
    }
}
interfaces {
    ge-0/0/1 {
        description "Uplink to ISP";
        unit 0 {
            family inet {
                address 192.168.1.1/24;
            }
        }
    }
    ge-0/0/2 {
        description "LAN to Access-Switch-01";
        unit 0 {
            family inet {
                address 10.0.0.1/24;
            }
        }
    }
}
`;

const ROUTEROS_EXPORT = `# CYBERSURE CONFIGURATION
# MikroTik RouterOS 7.x export
/system identity
set name=Router1
/system clock
/interface bridge
add name=bridge1
/interface ethernet
add name=ether1 mtu=1500
/ip address
add address=192.168.1.1/24 interface=ether1
add address=10.0.0.1/24 interface=bridge1
/ip dns
set servers=10.0.10.53,10.0.10.54
/ip service
set telnet=disabled
set ssh=enabled
set www=disabled
/system ntp client
set enabled=yes
set primary-ntp=10.0.10.60
`;

const FORTIOS_SAMPLE = `# CYBERSURE CONFIGURATION
config system global
    set hostname Edge-Firewall-01
    set dns suffix example.com
end
config system interface
    edit "port1"
        set ip 192.168.1.1 255.255.255.0
        set description "Uplink to ISP"
        set status up
    next
end
config system ntp
    set ntpserver 10.0.10.60
end
`;

const PANOS_SAMPLE = `set deviceconfig hostname Edge-Firewall-01
set deviceconfig domain-name example.com
set deviceconfig ssh version v2
set interface ethernet1/1 comment "Uplink to ISP"
set interface ethernet1/1 ip-address 192.168.1.1/24
set interface ethernet1/1 state up
set config deviceconfig setting
    set deviceconfig system setting ntp-server-primary 10.0.10.60
`;

const ARUBAOS_SAMPLE = `!
! CYBERSURE CONFIGURATION
hostname Wireless-Controller-01
!
vlan 10
   name "CLIENTS"
!
interface vlan 10
   ip address 10.20.0.1 255.255.255.0
   no shutdown
!
end
`;

const NXOS_SAMPLE = `!
! CYBERSURE CONFIGURATION
hostname Core-Switch-01
!
feature ssh
ip domain-name example.com
!
vlan 10
  name CLIENTS
!
interface Ethernet1/1
  description Server uplink
  no switchport
  ip address 10.40.0.2 255.255.255.0
  no shutdown
!
logging host 10.0.10.50
!
end
`;

const CISCO_ASA_SAMPLE = `!
! CYBERSURE CONFIGURATION
! Hand-authored for the prototype. Not collected from a live device.
!
ASA Version 9.16
hostname asa-edge-01
!
interface GigabitEthernet0/0
 nameif outside
 security-level 0
 ip address 203.0.113.10 255.255.255.0
!
interface GigabitEthernet0/1
 nameif inside
 security-level 100
 ip address 10.45.0.1 255.255.255.0
!
nat (inside,outside) source dynamic INSIDE interface OUTSIDE
access-list OUTSIDE_ACL extended permit tcp any host 203.0.113.20 eq 443
!
end
`;

const ARISTA_EOS_SAMPLE = `!
! CYBERSURE CONFIGURATION
! Hand-authored for the prototype. Not collected from a live device.
!
hostname Leaf-01
!
vlan 10
   name TENANT-A
!
interface Et1
   description Uplink
   no switchport
   ip address 10.90.0.2 255.255.255.0
!
interface Et2
   description Access
   switchport mode access
   switchport access vlan 10
!
ip route 0.0.0.0 0.0.0.0 10.90.0.254
!
end
`;

const HUAWEI_VRP_SAMPLE = `#
CYBERSURE CONFIGURATION
Hand-authored for the prototype. Not collected from a live device.
#
sysname VRP-Router-01
ip domain-name example.com
interface GigabitEthernet0/1
 description WAN uplink
 ip address 203.0.113.6 255.255.255.0
 undo shutdown
quit
interface GigabitEthernet0/2
 ip address 10.70.0.1 255.255.255.0
quit
ip route-static 0.0.0.0 0.0.0.0 203.0.113.5
ip name-server 10.0.0.53
ntp server 1 10.0.0.123
stelnet server enable
return
`;

const ARUBA_AOSCX_SAMPLE = `!
! CYBERSURE CONFIGURATION
! Hand-authored for the prototype. Not collected from a live device.
!
hostname Access-01
!
vlan 10
    name USERS
!
interface 1/1/1
    no switchport
    ip address 10.91.0.2 255.255.255.0
!
interface 1/1/2
    switchport mode access
    switchport access vlan 10
!
end
`;

const VYOS_SAMPLE = `!
! CYBERSURE CONFIGURATION
! Hand-authored for the prototype. Not collected from a live device.
!
set host-name 'vyos-01'
set domain-name 'example.com'
set system name-server '10.0.0.53'
set system ntp server '10.0.0.123'
set interfaces ethernet eth0 address '10.80.0.1/24'
set interfaces ethernet eth0 description 'WAN'
set interfaces ethernet eth1 address '10.81.0.1/24'
set ip route 0.0.0.0/0 via '10.80.0.254'
set service ssh port 22
commit
`;

/**
 * Sample configurations per source platform. The first entry is the default
 * that loads when a platform is picked as the "FROM device".
 */
export const CONFIG_SAMPLES: Record<PlatformId, ConfigSample[]> = {
  'cisco-iosxe': [
    {
      id: 'iosxe-core',
      name: 'Core router (minimal)',
      description: '8 commands — the smallest realistic IOS XE configuration.',
      config: CISCO_IOSXE_CORE,
    },
    {
      id: 'iosxe-edge',
      name: 'Edge router (extended)',
      description: 'Adds interfaces, logging, NTP, a banner and a default route.',
      config: CISCO_IOSXE_EDGE,
    },
  ],
  'cisco-ios': [
    {
      id: 'ios-legacy',
      name: 'Legacy branch router',
      description: 'Classic IOS 15.7 configuration with an encrypted service password.',
      config: CISCO_IOS_LEGACY,
    },
  ],
  'cisco-nxos': [
    {
      id: 'nxos-core',
      name: 'Core switch',
      description: 'NX-OS data-centre switching configuration.',
      config: NXOS_SAMPLE,
    },
  ],
  'juniper-junos': [
    {
      id: 'junos-set',
      name: 'Junos (set format)',
      description: 'Hierarchical "set" commands — the format Junos exports.',
      config: JUNOS_SET,
    },
    {
      id: 'junos-blocks',
      name: 'Junos (block format)',
      description: 'Brace-delimited configuration as edited in Junos CLI.',
      config: JUNOS_BLOCKS,
    },
  ],
  'fortinet-fortios': [
    {
      id: 'fortios-edge',
      name: 'FortiGate edge',
      description: 'FortiOS block configuration with interfaces and NTP.',
      config: FORTIOS_SAMPLE,
    },
  ],
  'paloalto-panos': [
    {
      id: 'panos-edge',
      name: 'PAN-OS edge firewall',
      description: 'PAN-OS device and interface configuration.',
      config: PANOS_SAMPLE,
    },
  ],
  'mikrotik-routeros': [
    {
      id: 'routeros-export',
      name: 'RouterOS 7.x export',
      description: 'Path-style export format produced by a RouterOS device.',
      config: ROUTEROS_EXPORT,
    },
  ],
  'aruba-arubaos': [
    {
      id: 'arubaos-wlc',
      name: 'ArubaOS controller',
      description: 'Campus controller with a client VLAN.',
      config: ARUBAOS_SAMPLE,
    },
  ],
  'cisco-asa': [
    {
      id: 'asa-edge',
      name: 'ASA edge firewall',
      description: 'Security contexts, security levels and dynamic NAT.',
      config: CISCO_ASA_SAMPLE,
    },
  ],
  'arista-eos': [
    {
      id: 'eos-leaf',
      name: 'Arista leaf',
      description: 'EOS leaf switch with a tenant VLAN and a routed uplink.',
      config: ARISTA_EOS_SAMPLE,
    },
  ],
  'huawei-vrp': [
    {
      id: 'vrp-router',
      name: 'VRP branch router',
      description: 'VRP configuration with static routing, DNS, NTP and stelnet.',
      config: HUAWEI_VRP_SAMPLE,
    },
  ],
  'aruba-aoscx': [
    {
      id: 'aoscx-access',
      name: 'AOS-CX access switch',
      description: 'Campus access switch with a user VLAN.',
      config: ARUBA_AOSCX_SAMPLE,
    },
  ],
  vyos: [
    {
      id: 'vyos-router',
      name: 'VyOS virtual router',
      description: 'VyOS set-form configuration with two Ethernet interfaces.',
      config: VYOS_SAMPLE,
    },
  ],
};

export function samplesFor(platform: PlatformId): ConfigSample[] {
  return CONFIG_SAMPLES[platform] ?? [];
}

export function defaultSample(platform: PlatformId): ConfigSample {
  return samplesFor(platform)[0];
}

/* -------------------------------------------------------------------------- */
/* Demo uploads offered by the "Upload File" control                          */
/* -------------------------------------------------------------------------- */

export const DEMO_UPLOADS: { name: string; filename: string; platform: PlatformId; config: string }[] = [
  { name: 'Core router (minimal)', filename: 'cybersure-demo-iosxe-core.cfg', platform: 'cisco-iosxe', config: CISCO_IOSXE_CORE },
  { name: 'Edge router (extended)', filename: 'cybersure-demo-iosxe-edge.cfg', platform: 'cisco-iosxe', config: CISCO_IOSXE_EDGE },
  { name: 'Junos (set format)', filename: 'cybersure-demo-junos-set.conf', platform: 'juniper-junos', config: JUNOS_SET },
  { name: 'Junos (block format)', filename: 'cybersure-demo-junos-blocks.conf', platform: 'juniper-junos', config: JUNOS_BLOCKS },
  { name: 'RouterOS 7.x export', filename: 'cybersure-demo-routeros.rsc', platform: 'mikrotik-routeros', config: ROUTEROS_EXPORT },
  { name: 'FortiGate edge', filename: 'cybersure-demo-fortios.conf', platform: 'fortinet-fortios', config: FORTIOS_SAMPLE },
];
