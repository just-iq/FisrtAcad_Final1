import { MobileLayout } from "@/components/layout/MobileLayout";
import { getAuthUser } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon, Mail, Building, BookOpen, Users } from "lucide-react";

export default function Profile() {
  const user = getAuthUser();
  const { logout } = useAuth();

  return (
    <MobileLayout title="Profile" subtitle="Your account details" showBack={true}>
      <div className="px-4 py-6 space-y-6">

        {/* Profile Header */}
        <div className="flex flex-col items-center justify-center p-6 bg-card rounded-2xl border border-border shadow-soft">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-4 border-4 border-background shadow-sm">
            <span className="text-3xl font-bold text-primary">
              {user?.full_name?.charAt(0).toUpperCase() || "?"}
            </span>
          </div>

          <h2 className="text-xl font-serif font-semibold text-foreground">
            {user?.full_name}
          </h2>

          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Mail className="w-4 h-4" />
            {user?.email}
          </p>
        </div>

        {/* User Details */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-soft">

          {/* Roles */}
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-muted-foreground" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Roles</p>
              <p className="text-sm font-medium text-foreground">
                {(user?.roles || ["STUDENT"]).join(", ").replace(/_/g, " ")}
              </p>
            </div>
          </div>

          {/* Department */}
          {user?.department && (
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <Building className="w-4 h-4 text-muted-foreground" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="text-sm font-medium text-foreground">
                  {user.department.name}
                </p>
              </div>
            </div>
          )}

          {/* Level */}
          {user?.level && (
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Level</p>
                <p className="text-sm font-medium text-foreground">
                  {user.level.name}
                </p>
              </div>
            </div>
          )}

          {/* Group */}
          {user?.group && (
            <div className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Group</p>
                <p className="text-sm font-medium text-foreground">
                  {user.group.name}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <Button
          variant="destructive"
          className="w-full h-12 rounded-xl text-base font-medium shadow-sm transition-transform active:scale-[0.98]"
          onClick={() => logout()}
        >
          <LogOut className="w-5 h-5 mr-2" />
          Log Out
        </Button>

      </div>
    </MobileLayout>
  );
}