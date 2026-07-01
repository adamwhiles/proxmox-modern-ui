import * as React from "react";
import { Navigate } from "react-router-dom";
import { ServerCog } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClusterRegistry } from "@/hooks/useClusters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BootstrapClusterForm } from "@/features/clusters/BootstrapClusterForm";

export function LoginPage() {
  const { user, login, loginError } = useAuth();
  const { data: clusters, isLoading, refetch } = useClusterRegistry();
  const [clusterId, setClusterId] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [realm, setRealm] = React.useState("pam");
  const [otp, setOtp] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const first = clusters?.[0];
    if (first && !clusterId) {
      setClusterId(first.id);
      setRealm(first.defaultRealm);
    }
  }, [clusters, clusterId]);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login({ clusterId, username, password, realm, otp: otp || undefined });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <ServerCog className="h-10 w-10 text-primary" />
          <h1 className="text-xl font-semibold">Proxmox Modern UI</h1>
          <p className="text-sm text-muted-foreground">Sign in with your Proxmox credentials</p>
        </div>

        {!isLoading && clusters && clusters.length === 0 ? (
          <BootstrapClusterForm onRegistered={() => refetch()} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Credentials are sent directly to the selected Proxmox cluster.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="cluster">Cluster</Label>
                  <Select value={clusterId} onValueChange={setClusterId}>
                    <SelectTrigger id="cluster">
                      <SelectValue placeholder="Select a cluster" />
                    </SelectTrigger>
                    <SelectContent>
                      {clusters?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.host})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="realm">Realm</Label>
                  <Input id="realm" value={realm} onChange={(e) => setRealm(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp">Two-factor code (if enabled)</Label>
                  <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Optional" />
                </div>
                {loginError && <p className="text-sm text-destructive">{loginError}</p>}
                <Button type="submit" className="w-full" disabled={submitting || !clusterId}>
                  {submitting ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
