export const CLASSROOMS = [
  "2/1", "2/2", "2/3", "2/4",
  "3/1", "3/2", "3/3", "3/4",
  "4/1", "4/2", "4/3", "4/4", "4/5",
  "5/1", "5/2", "5/3", "5/4", "5/5",
  "6/1", "6/2", "6/3", "6/4", "6/5"
] as const;

export type Classroom = (typeof CLASSROOMS)[number];

export const ALL_CLASSROOMS_VALUE = "__all__";

export const classroomOptions = (includeAll = false) => [
  ...(includeAll ? [{ value: ALL_CLASSROOMS_VALUE, label: "ภาพรวมทุกห้อง" }] : []),
  ...CLASSROOMS.map((cls) => ({ value: cls, label: `ห้องเรียน ${cls}` })),
];

export const classroomLabel = (classroom?: string | null) => {
  if (!classroom) return "-";
  if (classroom === ALL_CLASSROOMS_VALUE) return "ภาพรวมทุกห้อง";
  return `ห้องเรียน ${classroom}`;
};

export const normalizeClassroom = (classroom?: string | null): Classroom | null => {
  if (!classroom) return null;
  return CLASSROOMS.includes(classroom as Classroom) ? (classroom as Classroom) : null;
};
