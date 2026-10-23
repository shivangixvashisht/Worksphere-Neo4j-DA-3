// ====================================================================
// WorkSphere DA-3 - 02_seed.cypher
// Graph version of the ORIGINAL database/seed_oracle.sql (DA-II project).
// Every value below is copied from seed_oracle.sql; nothing is invented.
//   * Oracle relative dates  TO_CHAR(SYSDATE + n, 'YYYY-MM-DD') / SYSDATE + n
//     are stored as a day offset and resolved against the $today parameter.
//   * Foreign keys become relationships; FK columns are NOT stored as properties.
//
// Run with:  npm run seed          (recommended - passes $today automatically)
// Neo4j Browser:  :param today => toString(date())   then paste this file.
// ====================================================================

// 1. COWORKING_SPACES -> (:CoworkingSpace)
UNWIND [
  {space_id: 101, space_name: 'Nexus WorkHub - Guindy', address: 'No 45, Guindy Industrial Estate, Mount Road', city: 'Chennai', state: 'Tamil Nadu', pin: '600032'},
  {space_id: 102, space_name: 'Innovate Hub - OMR IT Expressway', address: 'Plot 12, Rajiv Gandhi Salai, Sholinganallur', city: 'Chennai', state: 'Tamil Nadu', pin: '600119'},
  {space_id: 103, space_name: 'Synergy Spaces - Anna Nagar', address: '2nd Avenue, Block AB, Anna Nagar West', city: 'Chennai', state: 'Tamil Nadu', pin: '600040'},
  {space_id: 104, space_name: 'Venture Loft - T. Nagar', address: '77 Venkatanarayana Road, T. Nagar', city: 'Chennai', state: 'Tamil Nadu', pin: '600017'}
] AS row
CREATE (s:CoworkingSpace)
SET s = row, s.created_at = datetime();

// 2. MEMBERSHIP_PLANS -> (:MembershipPlan)
UNWIND [
  {plan_id: 201, plan_name: 'Day Pass / Flexible', monthly_fee: 2500.00, duration_months: 1},
  {plan_id: 202, plan_name: 'Dedicated Resident Desk', monthly_fee: 8500.00, duration_months: 3},
  {plan_id: 203, plan_name: 'Startup Team Pod', monthly_fee: 22000.00, duration_months: 6},
  {plan_id: 204, plan_name: 'Enterprise Executive Plan', monthly_fee: 45000.00, duration_months: 12}
] AS row
CREATE (p:MembershipPlan)
SET p = row;

// 3. ORGANIZATIONS -> (:Organization)
UNWIND [
  {organization_id: 501, organization_name: 'Quantix AI Labs', industry: 'Artificial Intelligence'},
  {organization_id: 502, organization_name: 'FinTech Matrix India', industry: 'Banking and Finance'},
  {organization_id: 503, organization_name: 'CloudScale Solutions', industry: 'Cloud Infrastructure'},
  {organization_id: 504, organization_name: 'BioGenix Diagnostics', industry: 'Healthcare and Biotech'},
  {organization_id: 505, organization_name: 'Aether Robotics Pvt Ltd', industry: 'Automation & Robotics'}
] AS row
CREATE (o:Organization)
SET o = row;

// 4. PERSON superclass -> (:Person)   (middle_name NULL => property absent)
UNWIND [
  {person_id: 7001, first_name: 'Arjun', middle_name: 'Kumar', last_name: 'Mehta', email: 'arjun.mehta@worksphere.io', street: '12 Sardar Patel Rd', city: 'Chennai', state: 'Tamil Nadu', pin: '600036', phone: '+91 9876543210'},
  {person_id: 7002, first_name: 'Aditya', middle_name: null, last_name: 'Rao', email: 'aditya.rao@quantixai.com', street: '45 OMR Tech Corridor', city: 'Chennai', state: 'Tamil Nadu', pin: '600119', phone: '+91 9840123456'},
  {person_id: 7003, first_name: 'Sneha', middle_name: 'R.', last_name: 'Iyer', email: 'sneha.iyer@fintechmatrix.in', street: '88 Besant Avenue', city: 'Chennai', state: 'Tamil Nadu', pin: '600020', phone: '+91 9884112233'},
  {person_id: 7004, first_name: 'Rahul', middle_name: null, last_name: 'Verma', email: 'rahul.verma@cloudscale.io', street: '24 Nelson Manickam Rd', city: 'Chennai', state: 'Tamil Nadu', pin: '600029', phone: '+91 9791098765'},
  {person_id: 7005, first_name: 'Pooja', middle_name: 'S.', last_name: 'Nair', email: 'pooja.nair@biogenix.org', street: '67 1st Main Rd, Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pin: '600040', phone: '+91 9444055667'},
  {person_id: 7006, first_name: 'Siddharth', middle_name: 'R.', last_name: 'Raman', email: 'siddharth.r@aetherrobotics.com', street: '15 Gandhi Mandapam Rd', city: 'Chennai', state: 'Tamil Nadu', pin: '600025', phone: '+91 9884019283'},
  {person_id: 7007, first_name: 'Tanvi', middle_name: 'M.', last_name: 'Sundaram', email: 'tanvi.m@fintechmatrix.in', street: '92 Luz Church Rd, Mylapore', city: 'Chennai', state: 'Tamil Nadu', pin: '600004', phone: '+91 9790112244'},
  {person_id: 7008, first_name: 'Harish', middle_name: 'K.', last_name: 'Moorthy', email: 'harish.km@quantixai.com', street: '31 Harrington Road, Chetpet', city: 'Chennai', state: 'Tamil Nadu', pin: '600031', phone: '+91 9445123987'},
  {person_id: 7009, first_name: 'Vikram', middle_name: 'Chandran', last_name: 'Venkatesh', email: 'vikram.v@worksphere.in', street: '10 Cenotaph Road, Teynampet', city: 'Chennai', state: 'Tamil Nadu', pin: '600018', phone: '+91 9840011223'},
  {person_id: 7010, first_name: 'Ananya', middle_name: null, last_name: 'Subramanian', email: 'ananya.s@worksphere.in', street: '33 Gandhi Nagar, Adyar', city: 'Chennai', state: 'Tamil Nadu', pin: '600020', phone: '+91 9884455667'},
  {person_id: 7011, first_name: 'Karthik', middle_name: 'B.', last_name: 'Narayanan', email: 'karthik.n@worksphere.in', street: '52 GST Road, Chromepet', city: 'Chennai', state: 'Tamil Nadu', pin: '600044', phone: '+91 9790088990'},
  {person_id: 7012, first_name: 'Deepika', middle_name: null, last_name: 'Sundaram', email: 'deepika.s@worksphere.in', street: '19 Velachery Bypass Rd', city: 'Chennai', state: 'Tamil Nadu', pin: '600042', phone: '+91 9445566778'},
  {person_id: 7013, first_name: 'Manoj', middle_name: 'K.', last_name: 'Pillai', email: 'manoj.p@worksphere.in', street: '44 Mount-Poonamallee Rd', city: 'Chennai', state: 'Tamil Nadu', pin: '600089', phone: '+91 9176655443'},
  {person_id: 7014, first_name: 'Priya', middle_name: 'L.', last_name: 'Natarajan', email: 'priya.n@worksphere.in', street: '21 North Usman Road, T. Nagar', city: 'Chennai', state: 'Tamil Nadu', pin: '600017', phone: '+91 9841029384'}
] AS row
CREATE (p:Person)
SET p = row, p.created_at = datetime();

// 5. MEMBERS subclass -> extra label :Member on the same Person node
//    MEMBERS.plan_id FK -> (:Member)-[:HAS_PLAN]->(:MembershipPlan)
//    join_date = SYSDATE - n  ->  date($today) - n days
UNWIND [
  {member_id: 1001, person_id: 7001, plan_id: 202, join_day_offset: -60, status: 'ACTIVE'},
  {member_id: 1002, person_id: 7002, plan_id: 203, join_day_offset: -45, status: 'ACTIVE'},
  {member_id: 1003, person_id: 7003, plan_id: 204, join_day_offset: -30, status: 'ACTIVE'},
  {member_id: 1004, person_id: 7004, plan_id: 201, join_day_offset: -15, status: 'ACTIVE'},
  {member_id: 1005, person_id: 7005, plan_id: 203, join_day_offset: -10, status: 'ACTIVE'},
  {member_id: 1006, person_id: 7006, plan_id: 204, join_day_offset: -8, status: 'ACTIVE'},
  {member_id: 1007, person_id: 7007, plan_id: 202, join_day_offset: -5, status: 'ACTIVE'},
  {member_id: 1008, person_id: 7008, plan_id: 201, join_day_offset: -3, status: 'ACTIVE'}
] AS row
MATCH (p:Person {person_id: row.person_id})
MATCH (pl:MembershipPlan {plan_id: row.plan_id})
SET p:Member,
    p.member_id = row.member_id,
    p.join_date = date($today) + duration({days: row.join_day_offset}),
    p.status = row.status
CREATE (p)-[:HAS_PLAN]->(pl);

// 6. EMPLOYEES subclass -> extra label :Employee on the same Person node
UNWIND [
  {employee_id: 9001, person_id: 7009, job_title: 'Regional Operations Director', salary: 125000.00},
  {employee_id: 9002, person_id: 7010, job_title: 'Guindy Hub Community Manager', salary: 75000.00},
  {employee_id: 9003, person_id: 7011, job_title: 'OMR IT Hub Community Manager', salary: 78000.00},
  {employee_id: 9004, person_id: 7012, job_title: 'Lead AV & Network Infrastructure Engineer', salary: 68000.00},
  {employee_id: 9005, person_id: 7013, job_title: 'Guest Experience & Front Desk Host', salary: 42000.00},
  {employee_id: 9006, person_id: 7014, job_title: 'T. Nagar Experience & Booking Lead', salary: 45000.00}
] AS row
MATCH (p:Person {person_id: row.person_id})
SET p:Employee, p.employee_id = row.employee_id, p.job_title = row.job_title, p.salary = row.salary;

// 7. EMPLOYEES.supervisor_id recursive FK -> (:Employee)-[:SUPERVISES]->(:Employee)
UNWIND [
  {employee_id: 9002, supervisor_id: 9001},
  {employee_id: 9003, supervisor_id: 9001},
  {employee_id: 9004, supervisor_id: 9001},
  {employee_id: 9005, supervisor_id: 9002},
  {employee_id: 9006, supervisor_id: 9001}
] AS row
MATCH (boss:Employee {employee_id: row.supervisor_id})
MATCH (e:Employee {employee_id: row.employee_id})
CREATE (boss)-[:SUPERVISES]->(e);

// 8. MEETING_ROOMS -> (:MeetingRoom);  space_id FK -> (:CoworkingSpace)-[:CONTAINS]->(:MeetingRoom)
UNWIND [
  {room_id: 301, space_id: 101, room_name: 'Kaveri Conference Suite', room_type: 'Conference Room', capacity: 16, hourly_rate: 1200.00, status: 'AVAILABLE'},
  {room_id: 302, space_id: 101, room_name: 'Vaigai Brainstorm Pod', room_type: 'Meeting Pod', capacity: 4, hourly_rate: 450.00, status: 'AVAILABLE'},
  {room_id: 303, space_id: 101, room_name: 'Guindy Executive Boardroom', room_type: 'Boardroom Elite', capacity: 20, hourly_rate: 2200.00, status: 'AVAILABLE'},
  {room_id: 304, space_id: 101, room_name: 'Guindy Hot Desk Lounge', room_type: 'Hot Desk Lounge', capacity: 12, hourly_rate: 250.00, status: 'AVAILABLE'},
  {room_id: 305, space_id: 102, room_name: 'Silicon Boardroom Elite', room_type: 'Boardroom Elite', capacity: 24, hourly_rate: 2500.00, status: 'AVAILABLE'},
  {room_id: 306, space_id: 102, room_name: 'Innovation Lounge Desks', room_type: 'Hot Desk Lounge', capacity: 10, hourly_rate: 300.00, status: 'AVAILABLE'},
  {room_id: 307, space_id: 102, room_name: 'Cyber Sprint Pod', room_type: 'Meeting Pod', capacity: 6, hourly_rate: 550.00, status: 'AVAILABLE'},
  {room_id: 308, space_id: 102, room_name: 'OMR Cloud Training Suite', room_type: 'Training Hall', capacity: 45, hourly_rate: 3800.00, status: 'AVAILABLE'},
  {room_id: 309, space_id: 103, room_name: 'Marina Training Hall', room_type: 'Training Hall', capacity: 40, hourly_rate: 3500.00, status: 'AVAILABLE'},
  {room_id: 310, space_id: 103, room_name: 'Anna Nagar Creative Suite', room_type: 'Conference Room', capacity: 14, hourly_rate: 1100.00, status: 'AVAILABLE'},
  {room_id: 311, space_id: 103, room_name: 'Quiet Acoustic Focus Pod', room_type: 'Meeting Pod', capacity: 2, hourly_rate: 350.00, status: 'AVAILABLE'},
  {room_id: 312, space_id: 104, room_name: 'Zenith Discussion Room', room_type: 'Conference Room', capacity: 8, hourly_rate: 850.00, status: 'AVAILABLE'},
  {room_id: 313, space_id: 104, room_name: 'Royal Coromandel Boardroom', room_type: 'Boardroom Elite', capacity: 18, hourly_rate: 2100.00, status: 'AVAILABLE'},
  {room_id: 314, space_id: 104, room_name: 'T. Nagar Media & Podcasting Pod', room_type: 'Meeting Pod', capacity: 4, hourly_rate: 600.00, status: 'AVAILABLE'}
] AS row
MATCH (s:CoworkingSpace {space_id: row.space_id})
CREATE (r:MeetingRoom {room_id: row.room_id, room_name: row.room_name, room_type: row.room_type,
                       capacity: row.capacity, hourly_rate: row.hourly_rate, status: row.status})
CREATE (s)-[:CONTAINS]->(r);

// 9. ROOM_FACILITIES weak entity -> (:Facility); room_id FK -> (:MeetingRoom)-[:HAS_FACILITY]->(:Facility)
UNWIND [
  {facility_id: 401, room_id: 301, facility_name: 'Sony 4K HDR Smart Display 75-inch', quantity: 1},
  {facility_id: 402, room_id: 301, facility_name: 'Polycom Studio Video Bar & Mic Array', quantity: 1},
  {facility_id: 403, room_id: 301, facility_name: 'Magnetic Glass Whiteboard', quantity: 2},
  {facility_id: 404, room_id: 302, facility_name: 'Ultra-wide Curved Monitor 34-inch', quantity: 2},
  {facility_id: 405, room_id: 302, facility_name: 'Acoustic Soundproofing Enclosure', quantity: 1},
  {facility_id: 406, room_id: 303, facility_name: 'Dual 85-inch Touch Collaboration Screens', quantity: 2},
  {facility_id: 407, room_id: 303, facility_name: 'Cisco TelePresence Dual Camera System', quantity: 1},
  {facility_id: 408, room_id: 304, facility_name: 'Ergonomic Mesh Seating & Power Hubs', quantity: 12},
  {facility_id: 409, room_id: 305, facility_name: 'Quad 4K Multi-Presenter Displays', quantity: 4},
  {facility_id: 410, room_id: 305, facility_name: 'Bose Ceiling Array Microphone System', quantity: 1},
  {facility_id: 411, room_id: 306, facility_name: 'Gigabit Ethernet & Fast Wireless Charging', quantity: 10},
  {facility_id: 412, room_id: 307, facility_name: 'Smart Digital Whiteboard 65-inch', quantity: 1},
  {facility_id: 413, room_id: 308, facility_name: 'Epson Laser 4K Projector & 150-inch Screen', quantity: 1},
  {facility_id: 414, room_id: 309, facility_name: 'Laser Projector with 150-inch Motorized Screen', quantity: 1},
  {facility_id: 415, room_id: 309, facility_name: 'Wireless Handheld Mic & JBL Audio Suite', quantity: 2},
  {facility_id: 416, room_id: 310, facility_name: 'Samsung 65-inch 4K Video Conference Screen', quantity: 1},
  {facility_id: 417, room_id: 311, facility_name: 'Framery Soundproof Acoustic Glass Booth', quantity: 1},
  {facility_id: 418, room_id: 312, facility_name: 'Logitech Rally Plus Ultra-HD Video System', quantity: 1},
  {facility_id: 419, room_id: 313, facility_name: 'Executive Leather Seating & 85-inch 4K Display', quantity: 1},
  {facility_id: 420, room_id: 314, facility_name: 'Rodecaster Pro Podcast Audio Console & 4 Mics', quantity: 1}
] AS row
MATCH (r:MeetingRoom {room_id: row.room_id})
CREATE (f:Facility {facility_id: row.facility_id, facility_name: row.facility_name, quantity: row.quantity})
CREATE (r)-[:HAS_FACILITY]->(f);

// 10. BOOKINGS -> (:Booking)
//     member_id FK       -> (:Member)-[:MADE]->(:Booking)
//     room_id FK         -> (:Booking)-[:BOOKED_IN]->(:MeetingRoom)
//     organization_id FK -> (:Booking)-[:BOOKED_FOR]->(:Organization)
//     booking_date = TO_CHAR(SYSDATE + n,'YYYY-MM-DD') -> same 'YYYY-MM-DD' string
UNWIND [
  {booking_id: 5001, member_id: 1001, room_id: 301, organization_id: 501, day_offset: 0, start_time: '10:00', end_time: '12:00', total_amount: 2400.00, status: 'CONFIRMED'},
  {booking_id: 5002, member_id: 1003, room_id: 301, organization_id: 502, day_offset: 0, start_time: '14:00', end_time: '16:00', total_amount: 2400.00, status: 'CONFIRMED'},
  {booking_id: 5003, member_id: 1002, room_id: 302, organization_id: 501, day_offset: 0, start_time: '09:00', end_time: '11:00', total_amount: 900.00, status: 'CONFIRMED'},
  {booking_id: 5004, member_id: 1004, room_id: 302, organization_id: 503, day_offset: 0, start_time: '15:00', end_time: '17:00', total_amount: 900.00, status: 'CONFIRMED'},
  {booking_id: 5005, member_id: 1006, room_id: 303, organization_id: 505, day_offset: 0, start_time: '11:00', end_time: '13:00', total_amount: 4400.00, status: 'CONFIRMED'},
  {booking_id: 5006, member_id: 1003, room_id: 305, organization_id: 502, day_offset: 0, start_time: '14:00', end_time: '17:00', total_amount: 7500.00, status: 'CONFIRMED'},
  {booking_id: 5007, member_id: 1007, room_id: 306, organization_id: 502, day_offset: 0, start_time: '10:00', end_time: '13:00', total_amount: 900.00, status: 'CONFIRMED'},
  {booking_id: 5008, member_id: 1005, room_id: 309, organization_id: 504, day_offset: 0, start_time: '13:00', end_time: '16:00', total_amount: 10500.00, status: 'CONFIRMED'},
  {booking_id: 5009, member_id: 1008, room_id: 312, organization_id: 501, day_offset: 0, start_time: '09:00', end_time: '11:00', total_amount: 1700.00, status: 'CONFIRMED'},
  {booking_id: 5010, member_id: 1005, room_id: 301, organization_id: 504, day_offset: 1, start_time: '11:00', end_time: '13:00', total_amount: 2400.00, status: 'CONFIRMED'},
  {booking_id: 5011, member_id: 1002, room_id: 303, organization_id: 501, day_offset: 1, start_time: '14:00', end_time: '17:00', total_amount: 6600.00, status: 'CONFIRMED'},
  {booking_id: 5012, member_id: 1001, room_id: 305, organization_id: 501, day_offset: 1, start_time: '10:00', end_time: '12:00', total_amount: 5000.00, status: 'CONFIRMED'},
  {booking_id: 5013, member_id: 1004, room_id: 307, organization_id: 503, day_offset: 1, start_time: '15:00', end_time: '18:00', total_amount: 1650.00, status: 'CONFIRMED'},
  {booking_id: 5014, member_id: 1003, room_id: 310, organization_id: 502, day_offset: 1, start_time: '10:00', end_time: '12:00', total_amount: 2200.00, status: 'CONFIRMED'},
  {booking_id: 5015, member_id: 1006, room_id: 313, organization_id: 505, day_offset: 1, start_time: '14:00', end_time: '16:00', total_amount: 4200.00, status: 'CONFIRMED'},
  {booking_id: 5016, member_id: 1001, room_id: 301, organization_id: 501, day_offset: -1, start_time: '10:00', end_time: '12:00', total_amount: 2400.00, status: 'CONFIRMED'},
  {booking_id: 5017, member_id: 1002, room_id: 302, organization_id: 501, day_offset: -1, start_time: '14:00', end_time: '16:00', total_amount: 900.00, status: 'CONFIRMED'},
  {booking_id: 5018, member_id: 1003, room_id: 305, organization_id: 502, day_offset: -1, start_time: '11:00', end_time: '14:00', total_amount: 7500.00, status: 'CONFIRMED'},
  {booking_id: 5019, member_id: 1005, room_id: 312, organization_id: 504, day_offset: -1, start_time: '15:00', end_time: '17:00', total_amount: 1700.00, status: 'CONFIRMED'},
  {booking_id: 5020, member_id: 1007, room_id: 301, organization_id: 502, day_offset: 2, start_time: '09:00', end_time: '11:00', total_amount: 2400.00, status: 'CONFIRMED'},
  {booking_id: 5021, member_id: 1006, room_id: 305, organization_id: 505, day_offset: 3, start_time: '14:00', end_time: '18:00', total_amount: 10000.00, status: 'CONFIRMED'}
] AS row
MATCH (m:Member {member_id: row.member_id})
MATCH (r:MeetingRoom {room_id: row.room_id})
MATCH (o:Organization {organization_id: row.organization_id})
CREATE (b:Booking {booking_id: row.booking_id,
                   booking_date: toString(date($today) + duration({days: row.day_offset})),
                   start_time: row.start_time, end_time: row.end_time,
                   total_amount: row.total_amount, status: row.status, created_at: datetime()})
CREATE (m)-[:MADE]->(b)
CREATE (b)-[:BOOKED_IN]->(r)
CREATE (b)-[:BOOKED_FOR]->(o);

// 11. PAYMENTS -> (:Payment); booking_id FK -> (:Booking)-[:PAID_BY]->(:Payment)
UNWIND [
  {payment_id: 8001, booking_id: 5001, amount: 2400.00, day_offset: 0, method: 'UPI', status: 'COMPLETED'},
  {payment_id: 8002, booking_id: 5002, amount: 2400.00, day_offset: 0, method: 'Corporate Account', status: 'COMPLETED'},
  {payment_id: 8003, booking_id: 5003, amount: 900.00, day_offset: 0, method: 'UPI', status: 'COMPLETED'},
  {payment_id: 8004, booking_id: 5004, amount: 900.00, day_offset: 0, method: 'Credit Card', status: 'COMPLETED'},
  {payment_id: 8005, booking_id: 5005, amount: 4400.00, day_offset: 0, method: 'Corporate Account', status: 'COMPLETED'},
  {payment_id: 8006, booking_id: 5006, amount: 7500.00, day_offset: 0, method: 'Net Banking', status: 'COMPLETED'},
  {payment_id: 8007, booking_id: 5007, amount: 900.00, day_offset: 0, method: 'UPI', status: 'COMPLETED'},
  {payment_id: 8008, booking_id: 5008, amount: 10500.00, day_offset: 0, method: 'Corporate Account', status: 'COMPLETED'},
  {payment_id: 8009, booking_id: 5009, amount: 1700.00, day_offset: 0, method: 'Credit Card', status: 'COMPLETED'},
  {payment_id: 8010, booking_id: 5010, amount: 2400.00, day_offset: 0, method: 'UPI', status: 'COMPLETED'},
  {payment_id: 8011, booking_id: 5011, amount: 6600.00, day_offset: 0, method: 'Corporate Account', status: 'COMPLETED'},
  {payment_id: 8012, booking_id: 5012, amount: 5000.00, day_offset: 0, method: 'Net Banking', status: 'COMPLETED'},
  {payment_id: 8013, booking_id: 5013, amount: 1650.00, day_offset: 0, method: 'Credit Card', status: 'COMPLETED'},
  {payment_id: 8014, booking_id: 5014, amount: 2200.00, day_offset: 0, method: 'UPI', status: 'COMPLETED'},
  {payment_id: 8015, booking_id: 5015, amount: 4200.00, day_offset: 0, method: 'Corporate Account', status: 'COMPLETED'},
  {payment_id: 8016, booking_id: 5016, amount: 2400.00, day_offset: -1, method: 'UPI', status: 'COMPLETED'},
  {payment_id: 8017, booking_id: 5017, amount: 900.00, day_offset: -1, method: 'UPI', status: 'COMPLETED'},
  {payment_id: 8018, booking_id: 5018, amount: 7500.00, day_offset: -1, method: 'Corporate Account', status: 'COMPLETED'},
  {payment_id: 8019, booking_id: 5019, amount: 1700.00, day_offset: -1, method: 'Credit Card', status: 'COMPLETED'},
  {payment_id: 8020, booking_id: 5020, amount: 2400.00, day_offset: 0, method: 'Net Banking', status: 'COMPLETED'},
  {payment_id: 8021, booking_id: 5021, amount: 10000.00, day_offset: 0, method: 'Corporate Account', status: 'COMPLETED'}
] AS row
MATCH (b:Booking {booking_id: row.booking_id})
CREATE (p:Payment {payment_id: row.payment_id, amount: row.amount,
                   payment_date: date($today) + duration({days: row.day_offset}),
                   method: row.method, status: row.status})
CREATE (b)-[:PAID_BY]->(p);

// 12. Oracle SEQUENCES -> (:Sequence) counter nodes.
//     Values equal the original "ALTER SEQUENCE ... RESTART WITH" statements.
UNWIND [
  {name: 'SEQ_SPACES', next: 105}, {name: 'SEQ_PLANS', next: 205}, {name: 'SEQ_ORGS', next: 506},
  {name: 'SEQ_ROOMS', next: 315}, {name: 'SEQ_FACILITIES', next: 421}, {name: 'SEQ_PERSON', next: 7015},
  {name: 'SEQ_MEMBERS', next: 1009}, {name: 'SEQ_EMPLOYEES', next: 9007}, {name: 'SEQ_BOOKINGS', next: 5022},
  {name: 'SEQ_PAYMENTS', next: 8022}
] AS row
CREATE (:Sequence {name: row.name, next: row.next});
