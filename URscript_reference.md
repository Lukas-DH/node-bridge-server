Contents

1. Introduction 1
2. Connecting to URControl 2
3. Numbers, Variables, and Types 3
4. Lists and Structs 4
   4.1. Struct 4
   4.1.1. Using a struct 4
   4.2. List 5
   4.2.1. Limitations of lists 5
   4.3. Methods in URScript 6
   4.3.1. Methods on List 6
   4.3.2. Methods on Struct 8
   4.3.3. Methods on Matrix 8
5. Matrix and Array Expressions 9
6. Flow of Control 11
   6.1. Special keywords 11
7. Function 12
8. Remote Procedure Call (RPC) 13
   8.1. closeXMLRPCClientConnection() 13
9. Scoping rules 14
10. Threads 16
    10.1. Threads and scope 17
    10.2. Thread scheduling 17
11. Program Label 19
12. Secondary Programs 20
    12.1. Secondary Program Limitations 20
13. Interpreter Mode 21
    13.1. Interpreter Mode replies 21
    13.2. Entering Interpreter Mode 21
    13.3. End Interpreter Mode 22
    13.4. Clear Interpreter Mode 22
    13.5. Aborting Current Function 23
    13.6. Skip Non Executed Statements 23
    13.7. State Commands for Interpreter Mode 23
    13.8. Interpreter mode log files 24
14. Motion Version 25
    Script Directory e-Series
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    14.1. Modifying the motion version 25
    14.2. Availablity 26
15. Module motion 27
    15.1. conveyor*pulse_decode(type, A, B) 27
    15.2. direct_torque(torques, friction_comp=True) 28
    15.3. encoder_enable_pulse_decode(encoder_index, decoder_type, A, B) 29
    15.4. encoder_enable_set_tick_count(encoder_index, range_id) 29
    15.5. encoder_get_tick_count(encoder_index, opt="") 30
    15.6. encoder_set_tick_count(encoder_index, count) 31
    15.7. encoder_unwind_delta_tick_count(encoder_index, delta_tick_count) 31
    15.8. end_force_mode() 32
    15.9. end_freedrive_mode() 32
    15.10. end_screw_driving() 32
    15.11. end_teach_mode() 32
    15.12. force_mode(task_frame, selection_vector, wrench, type, limits) 32
    15.13. force_mode_example() 33
    15.14. force_mode_set_damping(damping) 33
    15.15. force_mode_set_gain_scaling(scaling) 34
    15.16. freedrive_mode (freeAxes=[1, 1, 1, 1, 1, 1], feature=p[0, 0, 0, 0, 0, 0]) 34
    15.17. freedrive_mode_no_incorrect_payload_check() 35
    15.18. get_conveyor_tick_count() 35
    15.19. get_freedrive_status() 35
    15.20. get_target_tcp_pose_along_path() 36
    15.21. get_target_tcp_speed_along_path() 36
    15.22. motion_version_get() 36
    15.23. motion_version_set(version) 37
    15.24. movec(pose_via, pose_to, a=1.2, v=0.25, r =0, mode=0) 37
    15.25. movej 38
    15.26. movel 39
    15.27. movep(pose, a=1.2, v=0.25, r=0) 39
    15.28. optimovej(goal, a=0.3, v=0.3, r=0) 40
    15.29. optimovel(goal, a=0.3, v=0.3, r=0) 41
    15.30. path_offset_disable(a=20) 42
    15.31. path_offset_enable() 42
    15.32. path_offset_get(type) 43
    15.33. path_offset_set(offset, type) 43
    15.34. path_offset_set_alpha_filter(alpha) 44
    15.35. path_offset_set_max_offset(transLimit, rotLimit) 44
    15.36. pause_on_error_code(code, argument) 45
    e-Series Script Directory
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    15.37. position_deviation_warning(enabled, threshold=0.8) 45
    15.38. reset_revolution_counter(qNear=[0.0, 0.0, 0.0, 0.0, 0.0, 0.0]) 46
    15.39. screw_driving(f, v_limit) 46
    15.40. servoj(q, a, v, t=0.002, lookahead_time=0.1, gain=300) 47
    15.41. set_conveyor_tick_count(tick_count, absolute_encoder_resolution=0) 48
    15.42. set_pos(q) 48
    15.43. set_safety_mode_transition_hardness(type) 49
    15.44. speedj(qd, a, t) 49
    15.45. speedl(xd, a, t, aRot=’a’) 49
    15.46. stop_conveyor_tracking(a=20) 50
    15.47. stopj(a) 50
    15.48. stopl(a, aRot=’a’) 51
    15.49. tool_wrench_limit_set(frame_offset, Fx, Fy, Fz, Mx, My, Mz) 51
    15.50. tool_wrench_limit_disable() 52
    15.51. teach_mode() 52
    15.52. track_conveyor_circular(center, ticks_per_revolution, rotate_tool=’False’, encoder*
    index=0) 52
    15.53. track_conveyor_linear(direction, ticks_per_meter, encoder_index=0) 53
16. Module internals 55
    16.1. force() 55
    16.2. estimate_payload(poses, wrenches) 55
    16.3. get_actual_joint_accelerations() 56
    16.4. get_actual_joint_positions() 56
    16.5. get_actual_joint_positions_history(steps=0) 56
    16.6. get_actual_joint_speeds() 56
    16.7. get_actual_tcp_pose() 57
    16.8. get_actual_tcp_speed() 57
    16.9. get_actual_tool_flange_pose() 57
    16.10. get_base_acceleration() 58
    16.11. get_controller_temp() 58
    16.12. get_coriolis_and_centrifugal_torques(q, qd) 58
    16.13. get_forward_kin(q=’current_joint_positions’, tcp=’active_tcp’) 58
    16.14. get_gravity() 59
    16.15. get_inverse_kin(x, qnear, maxPositionError =1e-10,maxOrientationError =1e-10,
    tcp=’active_tcp’) 59
    16.16. get_inverse_kin_has_solution(pose, qnear, maxPositionError=1E-10,
    maxOrientationError=1e-10, tcp="active_tcp") 60
    16.17. get_jacobian(q, tcp) 60
    16.18. get_jacobian_time_derivative(q, qd, tcp) 60
    Script Directory e-Series
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    16.19. get_joint_temp(j) 61
    16.20. get_joint_torques() 61
    16.21. get_mass_matrix(q, include_rotors_inertia=False) 61
    16.22. get_steptime() 62
    16.23. get_target_joint_accelerations() 62
    16.24. get_target_joint_positions() 62
    16.25. get_target_joint_speeds() 62
    16.26. get_target_payload() 63
    16.27. get_target_payload_cog() 63
    16.28. get_target_payload_inertia() 63
    16.29. get_target_tcp_pose() 63
    16.30. get_target_tcp_speed() 63
    16.31. get_target_waypoint() 64
    16.32. get_tcp_force() 64
    16.33. get_tcp_offset() 65
    16.34. get_tool_accelerometer_reading() 65
    16.35. get_tool_current() 65
    16.36. get_tool_temp() 65
    16.37. high_holding_torque_disable() 66
    16.38. high_holding_torque_enable() 66
    16.39. is_steady() 66
    16.40. is_within_safety_limits(position, qNear=current joint configuration) 67
    16.41. popup(s, title=’Popup’, warning=False, error=False, blocking=False) 67
    16.42. powerdown() 68
    16.43. protective_stop() 68
    16.44. set_base_acceleration(a) 68
    16.45. set_baselight_off() 69
    16.46. set_baselight_iec() 69
    16.47. set_baselight_solid(r,g,b) 69
    16.48. set_gravity(d) 69
    16.49. set_payload(m, cog) 70
    16.50. set_payload_cog(CoG) 71
    16.51. set_payload_mass(m) 71
    16.52. set_target_payload(m, cog, inertia=[0, 0, 0, 0, 0, 0], transition_time=0) 71
    16.53. set_tcp(pose, tcp_name="") 72
    16.54. sleep(t) 72
    16.55. time(mode=0) 73
    16.56. str_at(src, index) 74
    16.57. str_cat(op1, op2) 75
    e-Series Script Directory
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    16.58. str_empty(str) 76
    16.59. str_find(src, target, start_from=0) 76
    16.60. str_len(str) 77
    16.61. str_sub(src, index, len) 77
    16.62. sync() 78
    16.63. textmsg(s1, s2=’’) 78
    16.64. to_num(str ) 79
    16.65. to_str(val) 79
    16.66. tool_contact(direction) 80
    16.67. tool_contact_examples() 80
17. Module urmath 82
    17.1. acos(f ) 82
    17.2. asin(f ) 82
    17.3. atan(f ) 82
    17.4. atan2(x, y) 83
    17.5. binary_list_to_integer(l) 83
    17.6. ceil(f ) 84
    17.7. cos(f ) 84
    17.8. d2r(d) 84
    17.9. floor(f ) 85
    17.10. make_list(length, initial_value, capacity=length) 85
    17.11. get_list_length(v) 86
    17.12. integer_to_binary_list(x) 86
    17.13. interpolate_pose(p_from, p_to, alpha) 87
    17.14. inv(m) 87
    17.15. length(v) 88
    17.16. log(b, f ) 88
    17.17. norm(a) 89
    17.18. normalize(v) 89
    17.19. point_dist(p_from, p_to) 89
    17.20. pose_add(p_1, p_2) 90
    17.21. pose_dist(p_from, p_to) 90
    17.22. pose_inv(p_from) 91
    17.23. pose_sub(p_to, p_from) 91
    17.24. pose_trans(p_from, p_from_to) 92
    17.25. pow(base, exponent) 92
    17.26. r2d(r) 93
    17.27. random() 93
    17.28. rotvec2rpy(rotation_vector) 93
    Script Directory e-Series
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    17.29. rpy2rotvec(rpy_vector) 94
    17.30. sin(f ) 94
    17.31. size(v) 95
    17.32. sqrt(f ) 95
    17.33. tan(f) 95
    17.34. transpose(m) 96
    17.35. wrench_trans(T_from_to, w_from) 96
18. Module interfaces 97
    18.1. enable*external_ft_sensor(enable, sensor_mass=0.0, sensor_measuring_offset=[0.0,
    0.0, 0.0], sensor_cog=[0.0, 0.0, 0.0]) 97
    18.2. ft_rtde_input_enable(enable, sensor_mass=0.0, sensor_measuring_offset=[0.0, 0.0, 0.0],
    sensor_cog=[0.0, 0.0, 0.0]) 98
    18.3. get_analog_in(n) 99
    18.4. get_analog_out(n) 99
    18.5. get_configurable_digital_in(n) 100
    18.6. get_configurable_digital_out(n) 100
    18.7. get_digital_in(n) 100
    18.8. get_digital_out(n) 101
    18.9. get_flag(n) 101
    18.10. get_rtde_value(key) 102
    18.11. get_standard_analog_in(n) 102
    18.12. get_standard_analog_out(n) 103
    18.13. get_standard_digital_in(n) 103
    18.14. get_standard_digital_out(n) 103
    18.15. get_tool_analog_in(n) 104
    18.16. get_tool_digital_in(n) 104
    18.17. get_tool_digital_out(n) 105
    18.18. modbus_add_signal(IP, slave_number, signal_address, signal_type, signal_name,
    sequential_mode=False, register_count=1) 105
    18.19. modbus_add_rw_signal(IP, slave_number, read_address, read_register_count, write*
    address, write*register_count, signal_name, sequential_mode=False) 107
    18.20. modbus_delete_signal(signal_name) 108
    18.21. modbus_get_signal_status(signal_name, is_secondary_program=False) 108
    18.22. modbus_send_custom_command(IP, slave_number, function_code, data) 109
    18.23. modbus_set_digital_input_action(signal_name, action) 109
    18.24. modbus_set_output_register(signal_name, register_value, is_secondary*
    program=False) 110
    18.25. modbus*set_output_signal(signal_name, digital_value, is_secondary_program, False) 111
    18.26. modbus_set_signal_update_frequency(signal_name, update_frequency) 111
    18.27. modbus_get_error(signal_name) 112
    e-Series Script Directory
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    18.28. modbus_get_time_since_signal_invalid(signal_name) 113
    18.29. modbus_request_update_signal_value(signal_name) 113
    18.30. modbus_reset_connection(connection_id, is_blocking=True) 114
    18.31. modbus_set_signal_watchdog(signal_name, new_timeout_in_sec) 114
    18.32. read_input_boolean_register(address) 114
    18.33. read_input_float_register(address) 115
    18.34. read_input_integer_register(address) 115
    18.35. read_output_boolean_register(address) 116
    18.36. read_output_float_register(address) 116
    18.37. read_output_integer_register(address) 117
    18.38. read_port_bit(address) 117
    18.39. read_port_register(address) 117
    18.40. rpc_factory(type, url) 118
    18.41. rtde_set_watchdog(variable_name, min_frequency, action=’pause’) 119
    18.42. set_analog_inputrange(port, range) 119
    18.43. set_analog_out(n, f ) 120
    18.44. set_configurable_digital_out(n, b) 120
    18.45. set_digital_out(n, b) 120
    18.46. set_flag(n, b) 121
    18.47. set_standard_analog_out(n, f) 121
    18.48. set_standard_digital_out(n, b) 121
    18.49. set_tool_digital_out(n, b) 122
    18.50. set_tool_communication(enabled, baud_rate, parity, stop_bits, 122
    18.51. set_tool_digital_output_mode (n, mode) 123
    18.52. set_tool_output_mode (mode) 123
    18.53. set_tool_voltage(voltage) 124
    18.54. socket_close(socket_name=’socket_0’) 124
    18.55. socket_get_var(name, socket_name=’socket_0’) 124
    18.56. socket_open(address, port, socket_name=’socket_0’) 125
    18.57. socket_read_ascii_float(number, socket_name=’socket_0’, timeout=2) 125
    18.58. socket_read_binary_integer(number, socket_name=’socket_0’, timeout=2) 126
    18.59. socket_read_byte_list(number, socket_name=’socket_0’, timeout=2) 127
    18.60. socket_read_line(socket_name=’socket_0’, timeout=2) 127
    18.61. socket_read_string(socket_name=’socket_0’, prefix =’’, suffix =’’, interpret*
    escape=’False’, timeout=2) 128
    18.62. socket_send_byte(value, socket_name=’socket_0’) 129
    18.63. socket_send_int(value, socket_name=’socket_0’) 129
    18.64. socket_send_line(str, socket_name=’socket_0’) 130
    18.65. socket_send_string(str, socket_name=’socket_0’) 130
    Script Directory e-Series
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    18.66. socket_set_var(name, value, socket_name=’socket_0’) 131
    18.67. write_output_boolean_register(address, value) 131
    18.68. write_output_float_register(address, value) 132
    18.69. write_output_integer_register(address, value) 132
    18.70. write_port_bit(address, value) 132
    18.71. write_port_register(address, value) 133
    18.72. zero_ftsensor() 133
    18.73. request_boolean_from_primary_client(message) 133
    18.74. request_float_from_primary_client(message) 134
    18.75. request_integer_from_primary_client(message) 134
    18.76. request_string_from_primary_client(message) 134
19. Module ioconfiguration 136
    19.1. modbus_set_runstate_dependent_choice(signal_name, runstate_choice) 136
    19.2. set_analog_outputdomain(port, domain) 136
    19.3. set_configurable_digital_input_action(port, action) 137
    19.4. set_gp_boolean_input_action(port, action) 137
    19.5. set_input_actions_to_default() 138
    19.6. set_runstate_configurable_digital_output_to_value(outputId, state) 138
    19.7. set_runstate_gp_boolean_output_to_value(outputId, state) 139
    19.8. set_runstate_standard_analog_output_to_value(outputId, state) 140
    19.9. set_runstate_standard_digital_output_to_value(outputId, state) 140
    19.10. set_runstate_tool_digital_output_to_value(outputId, state) 141
    19.11. set_standard_analog_input_domain(port, domain) 142
    19.12. set_standard_digital_input_action(port, action) 142
    19.13. set_tool_analog_input_domain(port, domain) 143
    19.14. set_tool_digital_input_action(port, action) 143
20. Module processpath 144
    20.1. This module contains Remote TCP and toolpath APIs. 144
    20.2. mc_add_circular(pose_via, pose_to, a, v, r, mode=0) 144
    20.3. mc_add_linear(pose, a, v, r) 145
    20.4. mc_add_path(path_id, a, v, r) 145
    20.5. mc_get_target_rtcp_speed() 146
    20.6. mc_initialize(mode, tcp, doc=6) 146
    20.7. mc_load_path(nc_file, useFeedRate) 147
    20.8. mc_run_motion(id=-1) 147
    20.9. mc_set_pcs(pcs) 148
    20.10. mc_set_speed_factor(s) 148
    20.11. Examples 148
    e-Series Script Directory
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    20.11.1. Example 1 - Executing a remote TCP path 148
    20.11.2. Example 2 - Executing a regular TCP path using 5-DOF 149
    20.11.3. Example 3 - Executing a path and set digital output 149
    20.12. myToolPathFile.nc 150
21. Flexible Ethernet/IP Adapter 160
    21.1. Configuration interface 160
    21.1.1. add*configuration(Robot_to_PLC_inst_id, Robot_to_PLC_inst_size, PLC_to*
    Robot*inst_id, PLC_to_Robot_inst_size) 160
    21.1.2. is_instance_connected(PLC_to_Robot_inst_id) 161
    21.2. Functions 161
    21.2.1. eip_reader_factory(instance_name, data_size) 161
    21.2.2. eip_writer_factory(instance_name, data_size) 162
    21.3. Methods on reader and writer handles 162
    21.3.1. define*...(offset, data*name) - numeric fields 162
    21.3.2. define_bit(offset, bit_number, data_name, bitfield_width=1) 163
    21.3.3. define*...\_array(offset, length, data_name) - arrays of numeric fields 163
    21.3.4. define_string(offset, length, data_name) 164
    21.3.5. read(data_names) 164
    21.3.6. write(data_struct) 165
    21.3.7. clear() 165
    21.3.8. set_watchdog(frequency, action) 165
    21.3.9. start_watchdog() 166
    21.3.10. stop_watchdog() 166
    21.3.11. close() 166

22. Numbers, Variables, and Types
    In URScript arithmetic expression syntax is standard:
    1+2-3
    4*5/6
    (1+2)*3/(4-5)
    2346.44 % 10
    "Hello" + ", " + "World!"
    In boolean expressions, boolean operators are spelled out:
    True or False and (1 == 2) 1 > 2 or 3 != 4 xor 5 < -6
    not 42 >= 87 and 87 <= 42
    "Hello" != "World" and "abc" == "abc"
    Variable assignment is done using the equal sign =:
    foo = 42
    bar = False or True and not False baz = 87-13/3.1415
    hello = "Hello, World!" l = [1,2,4]
    target = p[0.4,0.4,0.0,0.0,3.14159,0.0]
    The fundamental type of a variable is deduced from the first assignment of the vari- able. In the example above
    foo is an int and bar is a bool. target is a pose: a combination of a position and orientation.
    The fundamental types are:
    • none
    • bool
    • number - either int or float
    • pose
    • string
    A pose is given as p[x,y,z,ax,ay,az], where x,y,z is the position of the TCP, and ax,ay,az is the
    orientation of the TCP, given in axis-angle notation.
    Note that strings are fundamentally byte arrays without knowledge of the encoding used for the characters it
    contains. Therefore some string functions that may appear to operate on characters (e.g. str_len), actually
    operates on bytes and the result may not correspond to the expected one in case of string containing
    sequences of multi-byte or variable-length characters. Refer to the description of the single function for more
    details.
    Script Directory 3 e-Series
23. Numbers, Variables, and Types
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
24. Lists and Structs
    4.1. Struct
    A set of variables can be aggregated into structs, and thus transferred and stored as a single variable.
    Structs can be obtained through multiple means:
    • Using the struct function
    • Doing an RPC call that returns a struct
    • Receiving ROS2 message (available on Polyscope X only)
    The struct function takes one or more named arguments, and each argument name becomes a member in the
    struct. All values must be initialized by value, and the type of the value cannot be changed subsequently.
    4.1.1. Using a struct
    Create a struct:
    myStruct = struct(identifier1 = 1, identifier2 = 2, myMember = "Hello structs",
    listMember = [1,2,3])
    Reassign a member:
    myStruct.myMember = "Goodbye structs"
    Use a member:
    myVar = myStruct.myMember
    Use a nested list:
    myListElement = myStruct.listMember[0]
    Use the second member by index (identifier2):
    myVar = myStruct[1]
    A nested struct, stored by value:
    myStruct = struct(myStructMember = struct(myMember = "Hi nested struct") )
    Conversion of a struct to a list, if all the struct members are of same type and if the list has the same type.
    Value of myList will be [1.1, 2.2, 3.3, 4.4].
    myStruct = struct(m1 = 1.1, m2 = 2.2, m3 = 3.3, m4 = 4.4)
    myList = [0.0, 0.0, 0.0, 0.0]
    myList = myStruct
    Structs can be passed to and returned from function. In this example we create a new struct extended with a
    boolean member.
    struct*1 = struct(m1 = 1.1, m2="a string", m3=[1,2,3])
    def ExtendStructWithBoolMember(struct_arg):
    struct_local = struct(m1 = 0.0, m2 = "n/a", m3 = make_list(0, 0, 10), extra*
    member = False)
    struct_local.m1 = struct_arg.m1
    struct_local.m2 = struct_arg.m2
    e-Series 4 Script Directory
25. Lists and Structs
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    struct_local.m3 = struct_arg.m3
    struct_local.extra_member = True
    return struct_local
    end
    new_extended_struct = ExtendStructWithBoolMember(struct_1)
    4.2. List
    A list is a set of variables with the same type aggregated into a single object.
    A list object in URScript has two attributes: length and capacity. The length indicates how many elements the
    list currently holding. The capacity tells how many elements the list can hold maximum.
    Once declared, the capacity of the list cannot be changed.
    Fixed length lists can be created with square bracket operator:
    aa = [11, 22, 33, 44, 55, 66, 77]
    Both length and capacity of this list is equal to 7.
    Variable length lists can be created:
    bb = make_list(length = 7, initial_value = 11, capacity = 20)
    Length of this list is 7, but capacity is 20. List can be extended and contracted between 0, and 20 numeric
    elements.
    Lists can hold any type that URScript supports. This includes complex values created with struct() keyword:
    aa = [1, 2, 3.5, 4, 5.5]
    bb = make_list(10, struct(p1 = 1, p2 = "text"), 10)
    cc = ["a", "b", "c", "d"]
    dd = [struct(m1 = 10, m2 = "hello", m3 = make_list(length = 25, initial_value
    = 0, capacity = 100)) , struct(m1 = 20, m2 = "hi", m3 = make_list(length = 50,
    initial_value = 0, capacity = 100))]
    List can be assigned only to existing list of greater or equal capacity to the length of source list:
    aa = [1, 2, 3, 4, 5, 6] # aa.length() == 6, aa.capacity() == 6
    bb = make_list(5, 0, 100) # bb.length() == 5, bb.capacity() == 100
    aa = bb # aa capacity will remain 6 aa length will be 5
    aa = [1, 2, 3, 4, 5, 6]
    bb = aa # bb capacity will remain 100 bb length will be 6
    List can hold structs (aka complex data types). All structs in the list have to be exactly of the same type:
    aa = make_list(10, struct(p1 = 1, p2 = "text"), 10)
    a = aa[4].p1 # a = 1
    b = aa[4].p2 # b = "text"
    aa[3].p1 = 22.5
    aa[4] = struct(p1 = 99, p2 = "different text")
    4.2.1. Limitations of lists
    Lists can be passed to, and returned from functions only as copy by value.
    List elements can't change type.
    Script Directory 5 e-Series
26. Lists and Structs
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    If list is returned from a function or list method, then the target list have to be earlier initialized with enough
    capacity.
    List of lists is not supported as this is how matrices are implemented in URScript.
    4.3. Methods in URScript
    Starting from Polyscope 5.15, methods (member functions) are callables on list, matrix and structs (currently).
    The name of the list followed by a "." will invoke the function.
    4.3.1. Methods on List
    append(element)
    Adds the element to the end of the list. Raises an error if at capacity.
    Example: add the value 88 to a list.
    l1 = make_list(0, 0, 10) # empty list of integers with capacity of 10
    l1.append(88) # add element to the end of the list, length increases, exception
    thrown if capacity exceeded
    capacity()
    Returns the maximum capacity of the list (>=length).
    Example: merge list 2 to list 1 until list 1 is full. result: [-1, -1, -1, -1, -1, 6, 7, 8, 9, 10]
    l1 = make_list(5, -1, 10)
    l2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    idx = l1.length()
    while(idx < l1.capacity()):
    l1.append(l2[idx])
    idx = idx + 1
    end
    clear()
    Clear the list by setting length to 0.
    list_1.clear() # list_1 will be []
    excess_capacity()
    Returns the unused capacity (= capacity-length).
    Example: add element if the list has free space. result: [9,9,9,9,9,1,2,3,4,5]; popup "no more space"
    l1 = make_list(5, 9, 10)
    l2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    idx = 0
    while(idx < l2.length()):
    if(l1.excess_capacity() > 0):
    l1.append(l2[idx])
    e-Series 6 Script Directory
27. Lists and Structs
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    else:
    popup("no more space")
    break
    end
    idx = idx + 1
    end
    extend(list of elements)
    Adds all elements from the parameter list at the end. Raises an error if at capacity. The list in the input must be
    of the same type as the list.
    Example: add list 2 to list 1. result = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    l1 = make_list(2, 0, 100)
    l2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    if l1.excess_capacity() >= l2.length():
    l1.extend(l2)
    end
    insert(index, element)
    Inserts the element at the given index, shifting remaining list. Raises an error if at capacity.
    length()
    Returns the current length of the list.
    Example: update elements of a list in a loop
    l1 = [1, 2, 3, 4, 5, 6]
    idx = 0
    while (idx < l1.length()):
    l1[idx] = 10 + idx
    idx = idx + 1
    end
    pop()
    Removes the last element from the list.
    remove(index)
    Removes the element at a given index.
    Example: remove even numbers from a collection.
    l2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11]
    idx = l2.length() - 1
    while(idx > 0):
    if(l2[idx] % 2 == 0):
    l2.remove(idx)
    end
    idx = idx - 1
    Script Directory 7 e-Series
28. Lists and Structs
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    end
    slice(begin index, end index)
    Returns a sub-list of elements [list[param1]... list[param2-1]]. Does not modify the original list.
    to_string()
    Returns a string representation of the list. has ...] if out of space.
    4.3.2. Methods on Struct
    length()
    Returns the number of elements in the struct.
    to_string()
    Returns a string representation of the struct. has ...} if out of space.
    4.3.3. Methods on Matrix
    get_column(index)
    Returns the column at the index by value.
    get_row(index)
    Returns the row at the index by value.
    shape()
    Returns the number of rows and columns in the matrix.
    to_string()
    Returns a string representation of the list. has ...] if out of space.
    e-Series 8 Script Directory
29. Lists and Structs
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
30. Matrix and Array Expressions
    Matrix and array operations can be assigned to a variable to store and manipulate multiple numbers at the
    same time. It is also possible to get access and write to a single entry of the matrix. The matrix and array are 0-
    indexed.
    array = [1,2,3,4,5]
    a = array[0]
    array[2] = 10
    matrix = [[1,2],[3,4],[5,6]]
    b = matrix[0,0]
    matrix[2,1] = 20
    Matrix and array can be manipulated by matrix-matrix, array-array,matrix-array,matrixscalar and array-scalar
    operations.
    Matrix-matrix multiplication operations are supported if the first matrix’s number of columns matches the
    second matrix’s number of rows. The resulting matrix will have the dimensions of the first matrix number of
    rows and the second matrix number of columns.
    C = [[1,2],[3,4],[5,6]] _ [[10,20,30],[40,50,60]]
    Matrix-array multiplication operations are supported if the matrix is the first operand and array is second. If the
    matrix’s number of columns matches the arrays length, the resulting array will have the length as the matrix
    number of rows.
    C = [[1,2],[3,4],[5,6]] _ [10,20]
    Array-array operations are possible if both arrays are of the same length and supports: addition, subtraction,
    multiplication, division and modulo operations. The operation is executed index by index on both arrays and
    thus results in an array of the same length. E.g. a[i] b[i] = c[i].
    mul = [1,2,3] _ [10,20,30]
    div = [10,20,30] / [1,2,3]
    add = [1,2,3] + [10,20,30]
    sub = [10,20,30] - [1,2,3]
    mod = [10,20,30] % [1,2,3]
    Scalar operations on a matrix or an array are possible. They support addition, subtraction, multiplication,
    division and modulo operations. The scalar operations are done on all the entries of the matrix or the array.
    E.g. a[i] + b = c[i]
    mul1 = [1,2,3] _ 5
    mul2 = 5 \* [[1,2],[3,4],[5,6]]
    div1 = [10,20,30] / 10
    div2 = 10 / [10,20,30]
    add1 = [1,2,3] + 10
    add2 = 10 + [1,2,3]
    sub1 = [10,20,30] - 5
    Script Directory 9 e-Series
31. Matrix and Array Expressions
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    sub2 = 5 - [[10,20],[30,40]]
    mod1 = [11,22,33] % 5
    mod2 = 121 % [[10,20],[30,40]]
    e-Series 10 Script Directory
32. Matrix and Array Expressions
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
33. Flow of Control
    The flow of control of a program is changed by if-statements:
    if a > 3:
    a = a + 1
    elif b < 7:
    b = b * a
    else:
    a = a + b
    end
    and while-loops:
    l = [1,2,3,4,5]
    i = 0
    while i < 5:
    l[i] = l[i]*2
    i = i + 1
    end
    You can use break to stop a loop prematurely and continue to pass control to the next iteration of the
    nearest enclosing loop.
    6.1. Special keywords
    • halt immediately stops program execution and terminates the program. Not advisible while robot is in
    motion.
    • return returns from a function. When no value is returned, the keyword None must follow the keyword
    return.
    • pause pauses program execution.
    Script Directory 11 e-Series
34. Flow of Control
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
35. Function
    A function is declared as follows:
    def add(a, b):
    return a+b
    end
    The function can then be called like this:
    result = add(1, 4)
    It is also possible to give function arguments default values:
    def add(a=0,b=0):
    return a+b
    end
    If default values are given in the declaration, arguments can be either input or skipped as below:
    result = add(0,0)
    result = add()
    When calling a function, it is important to comply with the declared order of the ar- guments. If the order is
    different from its definition, the function does not work as ex- pected.
    Arguments can only be passed by value (including arrays). This means that any modi- fication done to the
    content of the argument within the scope of the function will not be reflected outside that scope.
    def myProg()
    a = [50,100]
    fun(a)
    def fun(p1):
    p1[0] = 25
    assert(p1[0] == 25)
    ...
    end
    assert(a[0] == 50)
    ...
    end
    URScript also supports named parameters.
    e-Series 12 Script Directory
36. Function
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
37. Remote Procedure Call (RPC)
    Remote Procedure Calls (RPC) are similar to normal function calls, except that the function is defined and
    executed remotely. On the remote site, the RPC function being called must exist with the same number of
    parameters and corresponding types (together the function’s signature). If the function is not defined remotely,
    it stops program execution. The controller uses the XMLRPC standard to send the parameters to the remote
    site and retrieve the result(s). During an RPC call, the controller waits for the remote function to complete.
    The XMLRPC standard is among others supported by C++ (xmlrpc-c library), Python and Java.
    Creating a URScript program to initialize a camera, take a snapshot and retrieve a new target pose:
    camera = rpc_factory("xmlrpc", "http://127.0.0.1/RPC2")
    if (! camera.initialize("RGB")):
    popup("Camera was not initialized")
    camera.takeSnapshot()
    target = camera.getTarget()
    camera.closeXMLRPCClientConnection()
    ...
    First the rpc_factory (see Interfaces section) creates an XMLRPC connection to the specified
    remote server. The camera variable is the handle for the remote function calls. You must initialize the camera
    and therefore call camera.initialize("RGB").
    The function returns a boolean value to indicate if the request was successful. In order to find a target position,
    the camera first takes a picture, hence the camera.takeSnapshot() call. Once the snapshot is taken, the
    image analysis in the remote site calculates the location of the target. Then the program asks for the exact
    target location with the function call target = camera.getTarget(). On return the target
    variable is as- signed the result. The camera.initialize("RGB"), takeSnapshot() and
    getTarget() functions are the responsibility of the RPC server.
    The closeXMLRPCClientConnection is closing the XMLRPC connection created by the rpc_factory. It
    is recommended to close the connection periodically, or when it's not used for a longer time. Some server
    implementations by default have a limit of rpc requests or inactivity watchdog timers.
    NOTE: The RPC handle does not automatically close the connecetion.
    The technical support website: http://www.universal-robots.com/support contains more examples of XMLRPC
    servers.
    8.1. closeXMLRPCClientConnection()
    Closes a Remote Procedure Call (RPC) handle.
    Script Directory 13 e-Series
38. Remote Procedure Call (RPC)
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
39. Scoping rules
    A URScript program is declared as a function without parameters:
    def myProg():
    end
    Every variable declared inside a program has a scope. The scope is the textual region where the variable is
    directly accessible. Two qualifiers are available to modify this visibility:
    • local qualifier tells the controller to treat a variable inside a function, as being truly local, even if a
    global variable with the same name exists.
    • global qualifier forces a variable declared inside a function, to be globally accessible.
    For each variable the controller determines the scope binding, i.e. whether the variable is global or local. In
    case no local or global qualifier is specified (also called a free variable), the controller will first try to find the
    variable in the globals and otherwise the variable will be treated as local.
    In the following example, the first a is a global variable and the second a is a local variable. Both variables are
    independent, even though they have the same name:
    def myProg():
    global a = 0
    def myFun():
    local a = 1
    ...
    end
    ...
    end
    Beware that the global variable is no longer accessible from within the function, as the local variable masks the
    global variable of the same name.
    In the following example, the first a is a global variable, so the variable inside the function is the same variable
    declared in the program:
    def myProg():
    global a = 0
    def myFun():
    a = 1
    ...
    end
    ...
    end
    For each nested function the same scope binding rules hold. In the following example, the first a is global
    defined, the second local and the third implicitly global again:
    e-Series 14 Script Directory
40. Scoping rules
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
    def myProg():
    global a = 0
    def myFun():
    local a = 1
    def myFun2():
    a = 2
    ...
    end
    ...
    end
    ...
    end
    The first and third a are one and the same, the second a is independent.
    Variables on the first scope level (first indentation) are treated as global, even if the global qualifier is
    missing or the local qualifier is used:
    def myProg():
    a = 0
    def myFun():
    a = 1
    ...
    end
    ...
    end
    The variables a are one and the same.
    Script Directory 15 e-Series
41. Scoping rules
    Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
42. Threads
    Threads are supported by a number of special commands.
    To declare a new thread a syntax similar to the declaration of functions are used:
    thread myThread():

# Do some stuff

return False
end
A couple of things should be noted. First of all, a thread cannot take any parameters, and so the parentheses
in the declaration must be empty. Second, although a return statement is allowed in the thread, the value
returned is discarded, and cannot be accessed from outside the thread. A thread can contain
other threads, the same way a function can contain other functions. Threads can in other words be nested,
allowing for a thread hierarchy to be formed.
To run a thread use the following syntax:
thread myThread():

# Do some stuff

return False
end
thrd = run myThread()
The value returned by the run command is a handle to the running thread. This handle can be used to interact
with a running thread. The run command spawns from the new thread, and then executes the instruction
following the run instruction.
A thread can only wait for a running thread spawned by itself. To wait for a running thread to finish, use the join
command:
thread myThread():

# Do some stuff

return False
end
thrd = run myThread()
join thrd
This halts the calling threads execution, until the specified thread finishes its execution. If the thread is already
finished, the statement has no effect.
To kill a running thread, use the kill command:
thread myThread():

# Do some stuff

return False
e-Series 16 Script Directory 10. Threads
Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
end
thrd = run myThread()
kill thrd
After the call to kill, the thread is stopped, and the thread handle is no longer valid. If the thread has children,
these are killed as well.
To protect against race conditions and other thread-related issues, support for critical sections is provided. A
critical section ensures the enclosed code can finish running before another thread can start running. The
previous statement is always true, unless a time-demanding command is present within the scope of the
critical section. In such a case, another thread will be allowed to run. Time-demanding commands include
sleep, sync, move-commands, and socketRead. Therefore, it is important to keep the critical section as short
as possible. The syntax is as follows:
thread myThread():
enter_critical

# Do some stuff

exit_critical
return False
end
10.1. Threads and scope
The scoping rules for threads are exactly the same, as those used for functions. See 1.7 for a discussion of
these rules.
10.2. Thread scheduling
Because the primary purpose of the URScript scripting language is to control the robot, the scheduling policy
is largely based upon the realtime demands of this task.
The robot must be controlled a frequency of 500 Hz, or in other words, it must be told what to do every 0.002
second (each 0.002 second period is called a frame). To achieve this, each thread is given a “physical” (or
robot) time slice of 0.002 seconds to use, and all threads in a runnable state is then scheduled in a 1 fashion.
Each time a thread is scheduled, it can use a piece of its time slice (by executing instructions that control the
robot), or it can execute instructions that do not control the robot, and therefore do not use any “physical” time.
If a thread uses up its entire time slice, either by use of “physical” time or by computational heavy instructions
(such as an infinite loop that do not control the robot) it is placed in a non-runnable state, and is not allowed to
run until the next frame starts. If a thread does not use its time slice within a frame, it is expected to switch to a
non-runnable state before the end of 2. The reason for this state switching can be a join instruction or simply
because the thread terminates.
1Before the start of each frame the threads are sorted, such that the thread with the largest remaining time
slice is to be scheduled first.
2If this expectation is not met, the program is stopped.
Script Directory 17 e-Series 10. Threads
Copyright © 2009–2025 by Universal Robots A/S. All rights reserved.
It should be noted that even though the sleep instruction does not control the robot, it still uses “physical”
time. The same is true for the sync instruction. Inserting sync or sleep will allow time for other threads to be
executed and is therefore recommended to use next to computational heavy instructions or inside infinite
loops that do not control the robot, otherwise an exception like "Lost communication with Controller" can be
raised with a consequent protective stop.
e-Series 18 Script Directory 10. Threads
Copyright © 2009–2025 by Universal Robots A/S. All rights reserved. 11. Program Label
Program label code lines, with an “$” as first symbol, are special lines in programs generated by PolyScope
that make it possible to track the execution of a program.
$ 2 "var_1= True"
global var_1= True
Script Directory 19 e-Series 11. Program Label
Copyright © 2009–2025 by Universal Robots A/S. All rights reserved. 12. Secondary Programs
Secondary program is executed by the robot controller concurrently and simultaneously with the primary script
program. It could be used to handle the I/O signals, while the primary program moves the robot between
waypoints. A secondary program could be sent to controller via primary or secondary TCP/IP socket, just like
any other script program and must follow the same script syntax as regular robot programs.
Notable exception is that secondary program should not use any “physical” time. In particular, it cannot contain
sleep, or move statements. Secondary program must be simple enough to be executed in a single controller
step, without blocking the realtime thread.
Exceptions on secondary program do not stop execution of the primary program. Exceptions are reported in
robot controller log files.
The secondary function must be defined using the keyword "sec" as follows:
sec secondaryProgram():
set_digital_out(1,True)
end
12.1. Secondary Program Limitations
Secondary programs are typically run as support programs, they are designed to be executed concurrently
with the primary program using real time control loop. Entire execution time is added to single real time cycle.
Due to their nature they have some limitations in using specific commands.
Motion Commands: Using any motion commands in secondary program such as movej, movel and servoj
will not work. They will cause an error of "Runtime is too much behind". The motion commands depend on the
external factor (real robot motion) and are waiting for the result of the execution, which is not possible in
secondary programs.
Interpreter Mode: Sending new commands during runtime essentially goes against the design of secondary
programs. This will again give you the error of runtime too much behind.
Socket: Socket communication can be used within secondary programs, but this is limited to executing simple
non-blocking commands like single socket_send. Slow remote server or attempt to execute multiple socket
commands will cause "Runtime too much behind", or prevent controller from executing real-time tasks. Socket
commands should be avoided in secondary programs.
XMLRPC: Like socket, XMLRPC calls can be used in secondary programs although they need to be executed
very quickly by remote server. XMLRPC calls should be avoided in secondary programs.
Sleep: Sleep, similar to motion commands is a blocking call by nature. It requires multiple real-time cycles to
complete. Using Sleep will cause an error of "Runtime is too much behind"
Threads: Threads in secondary programs are not supported. Thread code execution is not guaranteed, and
leads to undefined behaviour.
