/**
 * Five simulated hospitals around Greater Noida, placed at the distances used in
 * Table VIII of the paper (measured from DEMO_PATIENT_LOCATION), and one demo
 * user per role.
 */
import { hashPassword } from "./security.mjs";
import { destinationPoint } from "./ranking.mjs";

export const DEMO_PATIENT_LOCATION = [28.4744, 77.504];
export const DEMO_CITIZEN_PHONE = "+919811024521";
export const DEMO_STAFF_PASSWORD = "Demo@2026!";
export const DEMO_ADMIN_EMAIL = "admin@jeevansetu.demo";
export const DEMO_ADMIN_PASSWORD = "Admin@2026!";

const G = "general_emergency";
const T = "trauma_care";
const B = "burn_care";
const O = "orthopaedics";
const C = "cardiac_care";

export const SEED_HOSPITALS = [
  { key: "H1", name: "Sector Beta-2 City Hospital", address: "Beta-2, Greater Noida 201308", phone: "+91 120 410 2201", bearing: 20, km: 2.0, services: [G, O, C], beds: 4, staff: "Neha Gupta" },
  { key: "H2", name: "Alpha Care Hospital", address: "Alpha-2, Greater Noida 201310", phone: "+91 120 432 8810", bearing: 300, km: 4.98, services: [G, T], beds: 1, staff: "Imran Qureshi" },
  { key: "H3", name: "Pari Chowk Trauma Centre", address: "Pari Chowk, Greater Noida 201310", phone: "+91 120 456 7210", bearing: 120, km: 8.01, services: [G, T, O], beds: 6, staff: "Ritu Sharma" },
  { key: "H4", name: "Knowledge Park Medical Centre", address: "Knowledge Park II, Greater Noida 201306", phone: "+91 120 498 3307", bearing: 200, km: 11.93, services: [G, T, B], beds: null, staff: "Arjun Mehta" },
  { key: "H5", name: "Dadri Road Hospital", address: "GT Road, Dadri 203207", phone: "+91 120 266 1145", bearing: 250, km: 30.02, services: [G, T, B, C], beds: 8, staff: "Sunita Yadav" },
];

export const staffEmail = (key) => `staff.${key.toLowerCase()}@jeevansetu.demo`;

export function seed(store) {
  const now = Date.now();
  const staffHash = hashPassword(DEMO_STAFF_PASSWORD);
  store.insert("users", { role: "citizen", name: "Aman Verma", phone: DEMO_CITIZEN_PHONE, email: null, password_hash: null, hospital_id: null, is_active: true, created_at: new Date(now).toISOString() });
  store.insert("users", { role: "admin", name: "Kavita Rao", phone: null, email: DEMO_ADMIN_EMAIL, password_hash: hashPassword(DEMO_ADMIN_PASSWORD), hospital_id: null, is_active: true, created_at: new Date(now).toISOString() });
  for (const spec of SEED_HOSPITALS) {
    const [lat, lng] = destinationPoint(...DEMO_PATIENT_LOCATION, spec.bearing, spec.km);
    const hospital = store.insert("hospitals", {
      name: spec.name,
      address: spec.address,
      phone: spec.phone,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      services: [...spec.services].sort(),
      free_beds: spec.beds,
      beds_updated_at: spec.beds === null ? null : new Date(now - 10 * 60 * 1000).toISOString(),
      open_for_emergency: true,
      diversion: false,
      is_simulated: true,
      created_at: new Date(now).toISOString(),
    });
    store.insert("users", { role: "staff", name: spec.staff, phone: null, email: staffEmail(spec.key), password_hash: staffHash, hospital_id: hospital.id, is_active: true, created_at: new Date(now).toISOString() });
  }
}
