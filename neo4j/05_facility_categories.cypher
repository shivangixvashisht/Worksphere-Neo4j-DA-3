// ====================================================================
// WorkSphere DA-3 - 05_facility_categories.cypher
// *** DA-3 ENHANCEMENT - NOT PART OF THE ORIGINAL ORACLE DATA ***
//
// The original ROOM_FACILITIES table has 20 rows, each with a unique
// facility_name tied to exactly one room. The original data does NOT
// group facilities into categories. To demonstrate graph traversal
// (e.g. "rooms with video conferencing", "rooms similar to this one"),
// DA-3 adds :FacilityCategory nodes and links each ORIGINAL facility
// row to one or more categories.
//
// The original :Facility nodes are untouched. The mapping below is a
// manual DA-3 classification based on the wording of each facility
// name; every link is marked {source: 'DA-3 classification'}.
// ====================================================================

UNWIND [
  {name: 'Display Screen',        description: 'TVs, monitors and large displays'},
  {name: 'Video Conferencing',    description: 'Cameras, video bars and telepresence systems'},
  {name: 'Audio & Microphones',   description: 'Microphones, speakers and audio consoles'},
  {name: 'Whiteboard',            description: 'Physical or digital whiteboards / touch collaboration'},
  {name: 'Projector',             description: 'Projectors and projection screens'},
  {name: 'Acoustic Privacy',      description: 'Soundproof booths and acoustic enclosures'},
  {name: 'Seating & Furniture',   description: 'Ergonomic or executive seating'},
  {name: 'Power & Connectivity',  description: 'Power hubs, wired network, wireless charging'}
] AS c
MERGE (cat:FacilityCategory {name: c.name})
SET cat.description = c.description, cat.source = 'DA-3 enhancement';

UNWIND [
  {facility_id: 401, categories: ['Display Screen']},                          // Sony 4K HDR Smart Display 75-inch
  {facility_id: 402, categories: ['Video Conferencing', 'Audio & Microphones']},// Polycom Studio Video Bar & Mic Array
  {facility_id: 403, categories: ['Whiteboard']},                              // Magnetic Glass Whiteboard
  {facility_id: 404, categories: ['Display Screen']},                          // Ultra-wide Curved Monitor 34-inch
  {facility_id: 405, categories: ['Acoustic Privacy']},                        // Acoustic Soundproofing Enclosure
  {facility_id: 406, categories: ['Display Screen', 'Whiteboard']},            // Dual 85-inch Touch Collaboration Screens
  {facility_id: 407, categories: ['Video Conferencing']},                      // Cisco TelePresence Dual Camera System
  {facility_id: 408, categories: ['Seating & Furniture', 'Power & Connectivity']}, // Ergonomic Mesh Seating & Power Hubs
  {facility_id: 409, categories: ['Display Screen']},                          // Quad 4K Multi-Presenter Displays
  {facility_id: 410, categories: ['Audio & Microphones']},                     // Bose Ceiling Array Microphone System
  {facility_id: 411, categories: ['Power & Connectivity']},                    // Gigabit Ethernet & Fast Wireless Charging
  {facility_id: 412, categories: ['Whiteboard']},                              // Smart Digital Whiteboard 65-inch
  {facility_id: 413, categories: ['Projector']},                               // Epson Laser 4K Projector & 150-inch Screen
  {facility_id: 414, categories: ['Projector']},                               // Laser Projector with 150-inch Motorized Screen
  {facility_id: 415, categories: ['Audio & Microphones']},                     // Wireless Handheld Mic & JBL Audio Suite
  {facility_id: 416, categories: ['Video Conferencing', 'Display Screen']},    // Samsung 65-inch 4K Video Conference Screen
  {facility_id: 417, categories: ['Acoustic Privacy']},                        // Framery Soundproof Acoustic Glass Booth
  {facility_id: 418, categories: ['Video Conferencing']},                      // Logitech Rally Plus Ultra-HD Video System
  {facility_id: 419, categories: ['Seating & Furniture', 'Display Screen']},   // Executive Leather Seating & 85-inch 4K Display
  {facility_id: 420, categories: ['Audio & Microphones']}                      // Rodecaster Pro Podcast Audio Console & 4 Mics
] AS row
MATCH (f:Facility {facility_id: row.facility_id})
UNWIND row.categories AS catName
MATCH (cat:FacilityCategory {name: catName})
MERGE (f)-[rel:IN_CATEGORY]->(cat)
SET rel.source = 'DA-3 classification';
