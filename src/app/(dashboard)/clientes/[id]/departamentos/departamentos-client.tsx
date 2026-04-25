"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  upsertClientDepartment,
  deleteClientDepartment,
} from "@/app/actions/client-departments";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ClientDepartment, Organization } from "@/lib/types/database";

interface Props {
  org: Pick<Organization, "id" | "name" | "departments">;
  departments: ClientDepartment[];
}

interface DeptForm {
  id?: string;
  name: string;
  expected_participants: number;
  authorized_emails_raw: string;
}

function emptyForm(name = ""): DeptForm {
  return { name, expected_participants: 0, authorized_emails_raw: "" };
}

export function DepartamentosClient({ org, departments: initial }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<ClientDepartment[]>(initial);
  const [editing, setEditing] = useState<DeptForm | null>(null);
  const [isPending, startTransition] = useTransition();

  const openNew = () => setEditing(emptyForm());
  const openEdit = (d: ClientDepartment) =>
    setEditing({
      id: d.id,
      name: d.name,
      expected_participants: d.expected_participants,
      authorized_emails_raw: d.authorized_emails.join(", "),
    });

  const handleSave = () => {
    if (!editing) return;
    startTransition(async () => {
      const result = await upsertClientDepartment(org.id, {
        id: editing.id,
        name: editing.name,
        expected_participants: editing.expected_participants,
        authorized_emails: editing.authorized_emails_raw
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean),
      });
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast(editing.id ? "Departamento actualizado" : "Departamento creado", "success");
      setEditing(null);
      router.refresh();
      // Optimistic update
      if (editing.id) {
        setDepartments((prev) =>
          prev.map((d) => (d.id === editing.id ? (result.data as ClientDepartment) : d))
        );
      } else {
        setDepartments((prev) => [...prev, result.data as ClientDepartment]);
      }
    });
  };

  const handleDelete = (dept: ClientDepartment) => {
    if (!confirm(`¿Eliminar "${dept.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteClientDepartment(org.id, dept.id);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Departamento eliminado", "success");
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departamentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{org.name}</p>
        </div>
        <Link
          href={`/clientes/${org.id}`}
          className="text-sm text-[#D4622B] hover:underline"
        >
          ← Volver al cliente
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Configurá los departamentos de este cliente: cantidad esperada de participantes y emails
        autorizados para whitelist.
      </p>

      {/* Department list */}
      {departments.length === 0 && !editing ? (
        <div className="text-center py-12 text-gray-400 border rounded-xl">
          <p className="mb-3">Sin departamentos configurados</p>
          <button
            onClick={openNew}
            className="text-sm text-[#D4622B] hover:underline"
          >
            + Agregar el primero
          </button>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {departments.map((dept) => (
            <div key={dept.id} className="border rounded-xl p-4 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{dept.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {dept.expected_participants} participantes esperados
                  </p>
                  {dept.authorized_emails.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {dept.authorized_emails.map((email) => (
                        <span
                          key={email}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100"
                        >
                          {email}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(dept)}
                    className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(dept)}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline edit/create form */}
      {editing && (
        <div className="border-2 border-[#D4622B]/30 rounded-xl p-5 mb-6 bg-orange-50/30">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {editing.id ? "Editar departamento" : "Nuevo departamento"}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nombre del departamento
              </label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ej: Administración"
                className="w-full px-3 py-2 border rounded-lg text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Participantes esperados
              </label>
              <input
                type="number"
                min={0}
                max={999}
                value={editing.expected_participants}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    expected_participants: Math.max(0, Number(e.target.value)),
                  })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Emails autorizados (separados por coma)
              </label>
              <textarea
                value={editing.authorized_emails_raw}
                onChange={(e) =>
                  setEditing({ ...editing, authorized_emails_raw: e.target.value })
                }
                placeholder="juan@empresa.com, maria@empresa.com"
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Estos emails se usarán para verificar a los participantes de este departamento.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Button onClick={handleSave} loading={isPending} disabled={!editing.name.trim()}>
              {editing.id ? "Guardar cambios" : "Crear departamento"}
            </Button>
            <button
              onClick={() => setEditing(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!editing && (
        <button
          onClick={openNew}
          className="flex items-center gap-2 text-sm font-medium text-[#D4622B] hover:underline"
        >
          + Agregar departamento
        </button>
      )}

      {/* Summary */}
      {departments.length > 0 && (
        <div className="mt-8 p-4 bg-gray-50 rounded-xl border text-sm text-gray-600">
          <p className="font-medium text-gray-700 mb-1">Resumen</p>
          <p>
            {departments.length} departamento{departments.length !== 1 ? "s" : ""} ·{" "}
            {departments.reduce((s, d) => s + d.expected_participants, 0)} participantes
            esperados en total
          </p>
        </div>
      )}
    </div>
  );
}
