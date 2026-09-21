"use client";
import { useState } from "react";
import { Palette, Plus, Trash2 } from "lucide-react";
import { Card, Badge, Button, Input, Modal } from "@/components/ui";

export default function CardTemplatesPage() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Card Templates</h1>
          <p className="text-sm text-slate-500">Design invitation cards with QR placeholders and text fields</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-3.5 w-3.5" /> New Template</Button>
      </div>

      <Card title="Published Templates">
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-900">VIP Invitation</h4>
                <p className="text-xs text-slate-500">Published • Background: gold-gradient</p>
              </div>
              <Badge label="Published" variant="green" />
            </div>
            <div className="mt-3 flex gap-2">
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 shadow-sm">QR placeholder</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 shadow-sm">Guest name</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 shadow-sm">Event title</span>
            </div>
          </div>
        </div>
      </Card>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Card Template" size="lg">
        <form className="space-y-4">
          <Input label="Template name" name="name" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="QR placeholder X" name="qr_x" type="number" defaultValue={50} />
            <Input label="QR placeholder Y" name="qr_y" type="number" defaultValue={50} />
          </div>
          <Input label="Background file ID (from uploads)" name="background_file_id" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
