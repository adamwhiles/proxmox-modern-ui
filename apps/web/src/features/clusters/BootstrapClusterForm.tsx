import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddClusterForm } from "@/features/clusters/AddClusterForm";

export function BootstrapClusterForm({ onRegistered }: { onRegistered: () => void }) {
  const [setupToken, setSetupToken] = React.useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register your first cluster</CardTitle>
        <CardDescription>
          No clusters are registered yet. Enter the one-time <code>SETUP_TOKEN</code> configured on the
          server to register your first Proxmox cluster.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="setup-token">Setup token</Label>
          <Input id="setup-token" value={setupToken} onChange={(e) => setSetupToken(e.target.value)} />
        </div>
        <AddClusterForm setupToken={setupToken} onCreated={onRegistered} />
      </CardContent>
    </Card>
  );
}
