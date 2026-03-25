const { config } = require("../config/config");

async function recommendResources(student_id, user) {
  let res;
  try {
    res = await fetch(`${config.aiService.baseUrl}/recommend/resources/${student_id}`, {
      method: "GET",
      headers: { "content-type": "application/json" }
    });
  } catch {
    // AI service is down — return empty recommendations gracefully
    return { recommended_resources: [] };
  }
  if (!res.ok) {
    return { recommended_resources: [] };
  }
  /* 
     AI returns { recommended_resource_ids: ["uuid"...] }
     We need to hydrate these with actual resource details (title, etc.)
  */
  const aiData = await res.json();
  const ids = aiData.recommended_resource_ids || [];
  
  const { getResourcesByIds } = require("../models/resourceModel");
  const resources = await getResourcesByIds(ids);

  // Filter to only resources the student can actually access
  const accessible = resources.filter(r => {
    if (r.department_id && user.department_id && String(r.department_id) !== String(user.department_id)) return false;
    if (r.level_id && user.level_id && String(r.level_id) !== String(user.level_id)) return false;
    if (r.group_id && user.group_id && String(r.group_id) !== String(user.group_id)) return false;
    return true;
  });

  return { recommended_resources: accessible };
}

module.exports = { recommendResources };

