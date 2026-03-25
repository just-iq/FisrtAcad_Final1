import { useMemo, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Users, Shield, Megaphone, Search, MoreVertical, Check } from "lucide-react";
import { UserRole } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const tabs = [
  { label: "Users", value: "users", icon: Users },
  { label: "Roles", value: "roles", icon: Shield },
  { label: "Audit", value: "audit", icon: Megaphone },
];

// Users are fetched from backend (Admin-only)

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  lecturer: "Lecturer",
  student_executive: "Executive",
  course_rep: "Course Rep",
  student: "Student",
};

const roleBadgeColors: Record<UserRole, string> = {
  admin: "bg-priority-high text-primary-foreground",
  lecturer: "bg-primary text-primary-foreground",
  student_executive: "bg-status-warning text-primary-foreground",
  course_rep: "bg-status-pending text-primary-foreground",
  student: "bg-secondary text-secondary-foreground",
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const { data: usersData } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => (await api.usersList()).users
  });

  const users = useMemo(() => {
    return (usersData || []).map((u: any) => {
      // Map backend role names to frontend UserRole types
      const roleMapping: Record<string, string> = {
        "student_exec": "student_executive",
        "student_executive": "student_executive", // Handle if backend changes
        "course_rep": "course_rep",
        "admin": "admin",
        "lecturer": "lecturer",
        "student": "student"
      };

      // Priority order for role display
      const priority = ["admin", "lecturer", "student_executive", "course_rep", "student"];

      const userRoles = (u.roles || []).map((r: string) => {
        const lower = r.toLowerCase();
        return roleMapping[lower] || lower;
      });

      const bestRole = priority.find(p => userRoles.includes(p)) || "student";

      return {
        id: u.id,
        name: u.full_name,
        email: u.email,
        role: (bestRole as UserRole),
        department: u.department?.name || "",
        level: u.level?.name || "",
        group: u.group?.name || ""
      };
    });
  }, [usersData]);

  const filteredUsers = users.filter((user) => {
    const q = searchQuery.toLowerCase();
    return user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
  });

  // SRS: Admin Global Audit - view ALL announcements across all channels
  const { data: announcementsData } = useQuery({
    queryKey: ["admin", "announcements-audit"],
    queryFn: async () => (await api.announcementsAudit()).announcements
  });

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast({ title: "Select a user and a role", variant: "destructive" });
      return;
    }

    const roleNameByUi: Record<UserRole, string> = {
      admin: "ADMIN",
      lecturer: "LECTURER",
      student_executive: "STUDENT_EXEC",
      course_rep: "COURSE_REP",
      student: "STUDENT"
    };

    try {
      await api.userUpdate(selectedUser, {
        role_assignments: [{ name: roleNameByUi[selectedRole] }]
      });
      toast({ title: "Role updated" });
      window.location.reload();
    } catch (e: any) {
      toast({ title: e?.message || "Failed to update role", variant: "destructive" });
    }
  };

  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "student" as UserRole,
    departmentId: "",
    levelId: "",
    groupId: ""
  });
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string; order: number }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string; department_id: string; level_id: string }[]>([]);

  // Fetch academic data when modal opens
  const fetchAcademicData = async () => {
    try {
      const [deptRes, levelRes, groupRes] = await Promise.all([
        api.getDepartments(),
        api.getLevels(),
        api.getGroups()
      ]);
      setDepartments(deptRes.departments);
      setLevels(levelRes.levels);
      setGroups(groupRes.groups);
    } catch (e) {
      console.error("Failed to fetch academic data", e);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({
        full_name: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email,
        password: newUser.password,
        // Map UI role to backend role name
        roles: [{
          admin: "ADMIN",
          lecturer: "LECTURER",
          student_executive: "STUDENT_EXEC",
          course_rep: "COURSE_REP",
          student: "STUDENT"
        }[newUser.role]],
        department_id: newUser.departmentId || null,
        level_id: newUser.levelId || null,
        group_id: newUser.groupId || null
      });
      toast({ title: "User created successfully" });
      setIsCreateUserOpen(false);
      setNewUser({ firstName: "", lastName: "", email: "", password: "", role: "student", departmentId: "", levelId: "", groupId: "" });
      // Invalidate query to refresh list
      // queryClient.invalidateQueries(["admin", "users"]); // Ideally we'd do this if we had queryClient access here
      window.location.reload(); // Simple reload for now
    } catch (e: any) {
      toast({ title: e?.message || "Failed to create user", variant: "destructive" });
    }
  };

  return (
    <MobileLayout title="Admin Panel" subtitle="Manage users & roles">
      <div className="px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-secondary rounded-xl mb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab.value
                    ? "bg-card text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-card"
                />
              </div>
              <Button
                onClick={() => {
                  setIsCreateUserOpen(true);
                  fetchAcademicData();
                }}
                className="h-11 rounded-xl"
              >
                + Add User
              </Button>
            </div>

            {/* Create User Modal (Inline for simplicity) */}
            {isCreateUserOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-background rounded-2xl w-full max-w-md p-6 shadow-elevated animate-in fade-in zoom-in-95">
                  <h3 className="text-lg font-bold font-serif mb-4">Create New User</h3>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="First Name"
                        value={newUser.firstName}
                        onChange={e => setNewUser({ ...newUser, firstName: e.target.value })}
                        required
                      />
                      <Input
                        placeholder="Last Name"
                        value={newUser.lastName}
                        onChange={e => setNewUser({ ...newUser, lastName: e.target.value })}
                        required
                      />
                    </div>
                    <Input
                      type="email"
                      placeholder="Email"
                      value={newUser.email}
                      onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                      required
                    />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                      required
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        value={newUser.role}
                        onValueChange={(v) => setNewUser({ ...newUser, role: v as UserRole })}
                      >
                        <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="lecturer">Lecturer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="student_executive">Executive</SelectItem>
                          <SelectItem value="course_rep">Course Rep</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={newUser.departmentId}
                        onValueChange={(v) => setNewUser({ ...newUser, departmentId: v })}
                        disabled={newUser.role === 'admin'}
                      >
                        <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                        <SelectContent>
                          {departments.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={newUser.levelId}
                        onValueChange={(v) => setNewUser({ ...newUser, levelId: v })}
                        disabled={newUser.role === 'admin'}
                      >
                        <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                        <SelectContent>
                          {levels.map(l => (
                            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={newUser.groupId}
                        onValueChange={(v) => setNewUser({ ...newUser, groupId: v })}
                        disabled={newUser.role === 'admin' || (!newUser.departmentId && !newUser.levelId)}
                      >
                        <SelectTrigger><SelectValue placeholder="Group" /></SelectTrigger>
                        <SelectContent>
                          {groups
                            .filter(g => (!newUser.departmentId || g.department_id === newUser.departmentId) && (!newUser.levelId || g.level_id === newUser.levelId))
                            .map(g => (
                              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                      <Button type="button" variant="ghost" onClick={() => setIsCreateUserOpen(false)}>Cancel</Button>
                      <Button type="submit">Create User</Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Users List */}
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="bg-card rounded-xl border border-border p-4 shadow-soft"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-lg">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", roleBadgeColors[user.role])}>
                      {roleLabels[user.role]}
                    </span>
                    <span className="text-xs text-muted-foreground">{user.department}</span>
                    {user.level && <span className="text-xs text-muted-foreground">• {user.level}</span>}
                    {user.group && <span className="text-xs text-muted-foreground">• {user.group}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Roles Tab */}
        {activeTab === "roles" && (
          <div className="space-y-4">
            <div className="bg-accent/50 rounded-xl border border-border p-4">
              <h3 className="font-serif font-semibold text-sm text-foreground mb-2">
                Assign Role
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Select a user and assign a new role
              </p>

              <div className="space-y-3">
                <Select onValueChange={(value) => setSelectedUser(value)}>
                  <SelectTrigger className="h-11 rounded-xl bg-card">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select onValueChange={(value) => setSelectedRole(value as UserRole)}>
                  <SelectTrigger className="h-11 rounded-xl bg-card">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="course_rep">Course Rep</SelectItem>
                    <SelectItem value="student_executive">Student Executive</SelectItem>
                    <SelectItem value="lecturer">Lecturer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>

                <Button className="w-full h-11 rounded-xl" onClick={handleAssignRole}>
                  <Check className="w-4 h-4 mr-2" />
                  Assign Role
                </Button>
              </div>
            </div>

            {/* Role Statistics */}
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(roleLabels).map(([role, label]) => {
                const count = users.filter((u) => u.role === role).length;
                return (
                  <div key={role} className="bg-card rounded-xl border border-border p-4 shadow-soft">
                    <p className="text-2xl font-bold font-serif text-foreground">{count}</p>
                    <p className="text-xs text-muted-foreground">{label}s</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Audit Tab - Global View of ALL Announcements */}
        {activeTab === "audit" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-2">
              Global audit view of all announcements across all channels
            </p>
            {(announcementsData || []).map((announcement: any) => (
              <div
                key={announcement.id}
                className="bg-card rounded-xl border border-border p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-serif font-semibold text-sm text-foreground leading-tight">
                    {announcement.title}
                  </h3>
                  <div className="flex gap-1 flex-shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                      {announcement.channel_type}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      roleBadgeColors[((announcement.role_context || "student").toLowerCase() as UserRole)]
                    )}>
                      {roleLabels[((announcement.role_context || "student").toLowerCase() as UserRole)]}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {announcement.body}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>By: {announcement.author_name || announcement.role_context}</span>
                  <time>{formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}</time>
                </div>
              </div>
            ))}
            {(!announcementsData || announcementsData.length === 0) && (
              <p className="text-center text-muted-foreground text-sm py-8">No announcements found</p>
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
