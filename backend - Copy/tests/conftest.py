"""Shared pytest configuration.

Ensures ``app`` is importable when pytest is run from the ``backend`` folder.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration fixtures used by the tests. These are minimal, representative
# snippets written for automated testing - they are not real customer data.
CISCO_IOS_SAMPLE = """
hostname Router-A
ip domain-name example.net
ip ssh version 2
ip ssh timeout 60
ip name-server 10.0.0.53
ntp server 10.0.0.123 prefer
logging host 10.0.0.99
service password-encryption

interface GigabitEthernet0/1
 description Uplink
 ip address 10.10.0.1 255.255.255.0
 mtu 1500
 no shutdown
!
interface GigabitEthernet0/2
 description Access port
 switchport
 switchport mode access
 switchport access vlan 30
!
interface Loopback0
 ip address 192.0.2.1 255.255.255.255
!
ip route 0.0.0.0 0.0.0.0 10.10.0.254
!
router ospf 10
 router-id 10.10.0.1
 network 10.10.0.0 0.0.0.255 area 0
!
line vty 0 4
 transport input ssh
!
end
"""

CISCO_IOS_XE_SAMPLE = """
hostname Edge-XE-01
ip domain-name example.net
ip ssh version 2
!
vlan 10
 name USERS
!
vlan 20
 name VOICE
!
interface GigabitEthernet1/0/1
 description Trunk uplink
 switchport
 switchport mode trunk
 switchport trunk allowed vlan 10,20
!
interface GigabitEthernet1/0/2
 description User port
 switchport
 switchport mode access
 switchport access vlan 10
!
interface GigabitEthernet1/0/10
 description Server
 ip address 10.20.0.2 255.255.255.0
 no shutdown
!
ip route 10.99.0.0 255.255.0.0 10.20.0.1 120
!
end
"""

CISCO_NXOS_SAMPLE = """
hostname Core-Switch-01
!
feature interface-vlan
feature ospf
!
vlan 10
  name CLIENTS
!
vlan 20
  name SERVERS
!
interface Ethernet1/1
  description Server uplink
  no switchport
  ip address 10.40.0.2 255.255.255.0
  mtu 9216
  no shutdown
!
interface Ethernet1/2
  description Client access
  switchport
  switchport mode access
  switchport access vlan 10
!
ip route 0.0.0.0 0.0.0.0 10.40.0.254
!
end
"""

JUNOS_SAMPLE = """
set system host-name Junos-Router-01
set system domain-name example.net
set system name-server 8.8.8.8
set system services ssh
set system ntp server 10.0.0.123
set system syslog host 10.0.0.99
set vlans 100
set vlans 100 name DATA
set interfaces ge-0/0/1 description Uplink
set interfaces ge-0/0/1 mtu 9192
set interfaces ge-0/0/1 unit 0 family inet address 172.16.0.1/30
set interfaces ge-0/0/2 unit 0 family ethernet-switching port-mode access
set interfaces ge-0/0/2 unit 0 family ethernet-switching vlan members 100
set routing-options static route 0.0.0.0/0 next-hop 172.16.0.2
commit
"""

FORTIOS_SAMPLE = """
config system global
    set hostname fw-edge-01
end
config system interface
    edit "port1"
        set description "WAN uplink"
        set ip 198.51.100.2 255.255.255.0
        set status up
    next
end
config system interface
    edit "port2"
        set description "LAN"
        set ip 10.30.0.1 255.255.255.0
    next
end
config system dns
    set primary-dns 10.0.0.53
    set secondary-dns 10.0.0.54
end
config router static
    edit 0
        set gateway 198.51.100.1
    next
end
"""

PANOS_SAMPLE = """
set deviceconfig hostname pa-edge-01
set deviceconfig domain-name example.net
set deviceconfig ssh version v2
set interface ethernet1/1 comment "WAN"
set interface ethernet1/1 ip-address 203.0.113.2/24
set interface ethernet1/1 netmask 255.255.255.0
set interface ethernet1/1 state up
set interface ethernet1/2 comment "DMZ"
set interface ethernet1/2 ip-address 10.40.0.1/24
set network config
    edit static-1
        set route 0.0.0.0/0
        set nexthop ip 203.0.113.1
    default
set vlan 20
set vlan 20 name "SERVERS"
"""

ROUTEROS_SAMPLE = """
/system identity
set name=router-01
/system ntp client
set enabled=yes
set primary-ntp=10.0.0.123
/ip address
add address=10.50.0.1/24 interface=ether1
add address=10.60.0.1/24 interface=ether2
/ip route
add dst-address=0.0.0.0/0 gateway=10.50.0.254
/ip dns
set servers=10.0.0.53,10.0.0.54
/ip service
set telnet=disabled
set ssh=enabled
"""

HUAWEI_SAMPLE = """
sysname VRP-Router-01
ip domain-name example.net
interface GigabitEthernet0/1
 description WAN uplink
 ip address 203.0.113.6 255.255.255.0
 mtu 1500
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
"""

VYOS_SAMPLE = """
set host-name 'vyos-01'
set domain-name 'example.net'
set system name-server '10.0.0.53'
set system ntp server '10.0.0.123'
set interfaces ethernet eth0 address '10.80.0.1/24'
set interfaces ethernet eth0 description 'WAN'
set interfaces ethernet eth1 address '10.81.0.1/24'
set ip route 0.0.0.0/0 via '10.80.0.254'
set service ssh port 22
commit
"""

ARISTA_EOS_SAMPLE = """
hostname Leaf-01
!
vlan 10
   name TENANT-A
!
interface Et1
   description Uplink
   no switchport
   ip address 10.90.0.2/24
!
interface Et2
   description Access
   switchport mode access
   switchport access vlan 10
!
ip route 0.0.0.0/0 10.90.0.254
!
end
"""

ARUBA_SAMPLE = """
hostname Access-01
!
vlan 10
    name USERS
!
interface 1/1/1
    no switchport
    ip address 10.91.0.2/24
!
interface 1/1/2
    switchport mode access
    switchport access vlan 10
!
end
"""

ASA_SAMPLE = """
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
"""

SAMPLES = {
    "cisco-ios": CISCO_IOS_SAMPLE,
    "cisco-iosxe": CISCO_IOS_XE_SAMPLE,
    "cisco-nxos": CISCO_NXOS_SAMPLE,
    "cisco-asa": ASA_SAMPLE,
    "juniper-junos": JUNOS_SAMPLE,
    "fortinet-fortios": FORTIOS_SAMPLE,
    "paloalto-panos": PANOS_SAMPLE,
    "mikrotik-routeros": ROUTEROS_SAMPLE,
    "arista-eos": ARISTA_EOS_SAMPLE,
    "huawei-vrp": HUAWEI_SAMPLE,
    "aruba-aoscx": ARUBA_SAMPLE,
    "vyos": VYOS_SAMPLE,
}
