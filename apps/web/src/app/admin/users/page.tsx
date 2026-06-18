"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner } from "@med/ui";
import { ALL_ROLES, Role, type AdminUserView } from "@med/shared";
import {
  adminBlockUser,
  adminCreateUser,
  adminListUsers,
  adminUnblockUser,
  adminUpdateUser,
} from "@/lib/admin";

const fieldClass =
  "h-9 rounded-lg border border-slate-300 px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Администратор",
  TEACHER: "Преподаватель",
  STUDENT: "Студент",
  EXAMINER: "Экзаменатор",
};
const roleLabel = (r: string) => ROLE_LABELS[r] ?? r;

export default function AdminUsersPage() {
  const [rows, setRows] = useState<AdminUserView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>("");
  const [status, setStatus] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListUsers({
        page,
        limit: 20,
        search: search || undefined,
        role: (role || undefined) as Role | undefined,
        status: status as "all" | "active" | "blocked",
      });
      setRows(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, search, role, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function quickRole(u: AdminUserView, newRole: Role) {
    const updated = await adminUpdateUser(u.id, { role: newRole });
    setRows((r) => r.map((x) => (x.id === u.id ? updated : x)));
  }
  async function toggleBlock(u: AdminUserView) {
    const updated = u.isActive ? await adminBlockUser(u.id) : await adminUnblockUser(u.id);
    setRows((r) => r.map((x) => (x.id === u.id ? updated : x)));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Пользователи</h1>
          <p className="text-sm text-slate-500">всего {total}</p>
        </div>
        <Button onClick={() => setShowCreate((s) => !s)}>{showCreate ? "Закрыть" : "Новый пользователь"}</Button>
      </div>

      {showCreate && (
        <CreateUserForm
          onCreated={() => {
            setShowCreate(false);
            setPage(1);
            load();
          }}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${fieldClass} flex-1 min-w-[180px]`}
          placeholder="Поиск по имени или эл. почте…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select className={fieldClass} value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }}>
          <option value="">Все роли</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
        <select className={fieldClass} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="all">Все</option>
          <option value="active">Активные</option>
          <option value="blocked">Заблокированы</option>
        </select>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size={28} />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Пользователь</th>
                  <th className="px-3">Роль</th>
                  <th className="px-3">Статус</th>
                  <th className="px-3">Регистрация</th>
                  <th className="px-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 align-middle">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800">
                        {u.firstName} {u.lastName}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-3">
                      <select
                        className={`${fieldClass} h-8`}
                        value={u.role}
                        onChange={(e) => quickRole(u, e.target.value as Role)}
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3">
                      <Badge tone={u.isActive ? "green" : "red"}>{u.isActive ? "активен" : "заблокирован"}</Badge>
                    </td>
                    <td className="px-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-3">
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditing(editing === u.id ? null : u.id)}>
                          Изменить
                        </Button>
                        <Button
                          size="sm"
                          variant={u.isActive ? "danger" : "secondary"}
                          onClick={() => toggleBlock(u)}
                        >
                          {u.isActive ? "Заблокировать" : "Разблокировать"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      Нет пользователей по этим фильтрам.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditUserForm
          user={rows.find((r) => r.id === editing)!}
          onClose={() => setEditing(null)}
          onSaved={(u) => {
            setRows((r) => r.map((x) => (x.id === u.id ? u : x)));
            setEditing(null);
          }}
        />
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center gap-3">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          ← Назад
        </Button>
        <span className="text-sm text-slate-500">
          Стр. {page} / {totalPages}
        </span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Вперёд →
        </Button>
      </div>
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<Role>(Role.STUDENT);
  const [institution, setInstitution] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminCreateUser({
        email,
        password,
        firstName,
        lastName,
        role,
        institution: institution || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать пользователя");
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Новый пользователь</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Input name="email" type="email" label="Эл. почта" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input name="password" type="password" label="Пароль (мин. 8)" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input name="firstName" label="Имя" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <Input name="lastName" label="Фамилия" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Роль</span>
            <select className={fieldClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <Input name="institution" label="Учреждение (необязательно)" value={institution} onChange={(e) => setInstitution(e.target.value)} />
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" isLoading={saving}>
              Создать пользователя
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EditUserForm({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUserView;
  onClose: () => void;
  onSaved: (u: AdminUserView) => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [institution, setInstitution] = useState(user.institution ?? "");
  const [role, setRole] = useState<Role>(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await adminUpdateUser(user.id, {
        firstName,
        lastName,
        institution: institution || null,
        role,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      setSaving(false);
    }
  }

  return (
    <Card className="border-brand-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Редактирование {user.email}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Input name="ef" label="Имя" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input name="el" label="Фамилия" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <Input name="ei" label="Учреждение" value={institution} onChange={(e) => setInstitution(e.target.value)} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Роль</span>
            <select className={fieldClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" isLoading={saving}>
              Сохранить
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
