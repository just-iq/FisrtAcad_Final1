import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Eye, EyeOff, ArrowRight, ArrowLeft, Briefcase } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Dept = { id: string; name: string };
type Level = { id: string; name: string; order: number };
type Group = { id: string; name: string };

export default function Signup() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState("STUDENT");

  // Academic data
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  // Student selections
  const [departmentId, setDepartmentId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [groupId, setGroupId] = useState("");

  // Load departments + levels once on mount
  useEffect(() => {
    api.getDepartments().then((r) => setDepartments(r.departments)).catch(console.error);
    api.getLevels().then((r) => setLevels(r.levels.sort((a, b) => a.order - b.order))).catch(console.error);
  }, []);

  // Load groups when dept + level are chosen
  useEffect(() => {
    if (departmentId && levelId) {
      setGroupId("");
      api.getGroups({ department_id: departmentId, level_id: levelId })
        .then((r) => setGroups(r.groups))
        .catch(console.error);
    } else {
      setGroups([]);
      setGroupId("");
    }
  }, [departmentId, levelId]);

  // Reset academic selections when role changes away from STUDENT
  useEffect(() => {
    if (role !== "STUDENT") {
      setDepartmentId("");
      setLevelId("");
      setGroupId("");
    }
  }, [role]);

  const isStudent = role === "STUDENT";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.target as HTMLFormElement);
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Validate student fields
    if (isStudent) {
      if (!departmentId) { toast.error("Please select your department"); setIsLoading(false); return; }
      if (!levelId) { toast.error("Please select your level"); setIsLoading(false); return; }
      if (!groupId && groups.length > 0) { toast.error("Please select your group"); setIsLoading(false); return; }
    }

    try {
      await api.signup({
        full_name: `${firstName} ${lastName}`,
        email,
        password,
        role,
        department_id: isStudent ? (departmentId || null) : null,
        level_id: isStudent ? (levelId || null) : null,
        group_id: isStudent ? (groupId || null) : null,
      });
      toast.success("Account created! Please log in.");
      navigate("/login");
    } catch (err: any) {
      if (err.message?.includes("duplicate key") || err.message?.includes("already exists")) {
        toast.error("An account with this email already exists.");
      } else {
        toast.error(err.message || "Failed to create account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Back button */}
      <div className="p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/login")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to login
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Logo */}
        <div className="mb-6 text-center animate-fade-in">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-elevated">
            <GraduationCap className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Create Account</h1>
          <p className="text-muted-foreground text-sm mt-1">Join your academic community</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 animate-slide-up">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
              <Input id="firstName" name="firstName" placeholder="John" className="h-11 rounded-xl bg-card border-border" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
              <Input id="lastName" name="lastName" placeholder="Doe" className="h-11 rounded-xl bg-card border-border" required />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">University Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@university.edu" className="h-11 rounded-xl bg-card border-border" required />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">I am a</Label>
            <Select value={role} onValueChange={setRole} required>
              <SelectTrigger className="h-11 rounded-xl bg-card border-border">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDENT">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <span>Student</span>
                  </div>
                </SelectItem>
                <SelectItem value="LECTURER">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span>Lecturer</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Student-only fields */}
          {isStudent && (
            <>
              {/* Department */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Department</Label>
                <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setLevelId(""); setGroupId(""); }} required>
                  <SelectTrigger className="h-11 rounded-xl bg-card border-border">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Level */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Level</Label>
                <Select value={levelId} onValueChange={(v) => { setLevelId(v); setGroupId(""); }} required>
                  <SelectTrigger className="h-11 rounded-xl bg-card border-border">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Group — always visible for students; enabled once dept + level are chosen */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Group</Label>
                {!departmentId || !levelId ? (
                  <div className="h-11 rounded-xl bg-card border border-border flex items-center px-3 text-sm text-muted-foreground select-none opacity-60 cursor-not-allowed">
                    Select department &amp; level first
                  </div>
                ) : groups.length > 0 ? (
                  <Select value={groupId} onValueChange={setGroupId} required>
                    <SelectTrigger className="h-11 rounded-xl bg-card border-border">
                      <SelectValue placeholder="Select your group (A, B, C...)" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
                    No groups found for this department &amp; level. Contact your admin.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                className="h-11 rounded-xl bg-card border-border pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium shadow-card hover:shadow-elevated transition-all mt-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Creating account...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Create Account
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>

        <p className="mt-6 text-xs text-center text-muted-foreground max-w-xs">
          By signing up, you agree to the university's academic policies and terms of use.
        </p>
      </div>
    </div>
  );
}
