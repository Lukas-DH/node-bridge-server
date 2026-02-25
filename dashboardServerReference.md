Dashboard Server e-Series, port 29999
Introduce all the commands that dashboard server can support. Take an example , connecting Dashboard Server with SocketTest software.

Last modified on Nov 17, 2025

Examples are valid for:
e-Series Software version: all software versions
Note that older or newer software versions may behave differently.

DASHBOARD SERVER COMMANDS - e-SERIES ONLY
A Universal Robot can be controlled from remote by sending simple commands to the GUI over a TCP/IP socket. This interface is called the "DashBoard server". The server is running on port 29999 on the robots IP address. Each command should be terminated by a ‘\n’ also called a newline.

NOTE:

Commands are not case sensitive.
Dashboard commands for CB-Series can be found here: CB-Series DashBoard commands
If a command is send but not allowed, the below error is returned
"Command is not allowed due to safety reasons, please switch robot to Remote Control mode and reconnect to port 29999"
Unlock protective stops
If the robot is locked due to a protective stop, you can unlock the robot using the Dashboard Server and entering the command: "Unlock Protective Stop". If you have more than 50 protective stops on one joint (including these error codes; C153-C157-C158-C159) within 8 hours, the software will trigger: 163: TOO_FREQUENT_PROTECTIVE_STOPS. Each joint has a separate counter for each protective stop, and when a counter reaches 50 protective stop on one joint for one type of protective stop, then you will see the error message 163: TOO_FREQUENT_PROTECTIVE_STOPS. If you trigger: 163: TOO_FREQUENT_PROTECTIVE_STOPS, you have to wait at least 5 seconds,
before you can unlock the robot by using the Dashboard Server. This has been enabled in order to make the user aware of excessive protective stops of one type of protective stop on one joint. There is only a 5s delay on 163

Commands attached in the bottom for download in pdf format

Testing the Dashboard server:

For testing purposes a program for testing sockets can be used, like HyperTerminal, or similar. In this example the freeware program SocketTest is used.

Setup a static IP-address and subnet mask on PC, so it matches the robot, e.g.:

PC: IP-addr: 192.168.3.10 Robot: IP-addr: 192.168.3.3
Subnet: 255.255.255.0 Subnet: 255.255.255.0

In the socket test program, use the Client tab to send commands to robot:
