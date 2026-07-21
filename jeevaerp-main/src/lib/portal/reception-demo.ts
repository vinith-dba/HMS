/** Demo data for the reception reference build. Swap for /api/v1/reception/* later. */
export const TODAY_APPOINTMENTS = [
  { id: "AP-501", time: "09:30", patient: "Suresh Naik", pid: "JMH2026OP00044", doctor: "Dr. A. Verma", dept: "Orthopaedics", status: "Completed" },
  { id: "AP-502", time: "10:15", patient: "Meera Iyer", pid: "JMH2026OP00045", doctor: "Dr. P. Das", dept: "Paediatrics", status: "Completed" },
  { id: "AP-503", time: "11:00", patient: "Farhan Sheikh", pid: "JMH2026OP00046", doctor: "Dr. K. Rao", dept: "Cardiology", status: "Checked-in" },
  { id: "AP-504", time: "11:45", patient: "Lakshmi P.", pid: "JMH2026OP00047", doctor: "Dr. S. Menon", dept: "Gynaecology", status: "Waiting" },
  { id: "AP-505", time: "12:30", patient: "Rohit Bansal", pid: "JMH2026OP00048", doctor: "Dr. A. Verma", dept: "Orthopaedics", status: "Waiting" },
];

export const OP_TREND = Array.from({ length: 14 }, (_, i) => ({
  label: `${i + 1}`,
  value: Math.round(38 + Math.sin(i / 2) * 12 + (i % 5) * 3),
}));

export const DEPT_SPLIT = [
  { label: "Cardiology", value: 32, color: "#0D7D82" },
  { label: "Orthopaedics", value: 24, color: "#E2A63B" },
  { label: "Gynaecology", value: 21, color: "#C1503F" },
  { label: "Paediatrics", value: 15, color: "#5B7FA6" },
  { label: "General", value: 8, color: "#8C99B4" },
];

export const RECENT_PATIENTS = [
  { pid: "JMH2026OP00048", name: "Rohit Bansal", age: 35, blood: "A+", last: "Today" },
  { pid: "JMH2026OP00047", name: "Lakshmi P.", age: 27, blood: "O-", last: "Today" },
  { pid: "JMH2026OP00046", name: "Farhan Sheikh", age: 41, blood: "B-", last: "Today" },
  { pid: "JMH2026OP00045", name: "Meera Iyer", age: 8, blood: "AB+", last: "Today" },
];
