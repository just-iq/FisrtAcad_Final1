function roomsForScope({ department_id, level_id, group_id, channel_type }) {
  if (channel_type === "SCHOOL") return ["school_global"];
  if (channel_type === "DEPARTMENT_LEVEL") {
    return department_id && level_id ? [`dept_${department_id}_level_${level_id}`] : [];
  }
  if (channel_type === "GROUP") {
    return group_id ? [`group_${group_id}`] : [];
  }
  return [];
}

module.exports = { roomsForScope };

