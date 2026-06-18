"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@med/ui";
import { login, register } from "@/lib/auth";
import { ApiRequestError } from "@/lib/api";
import { AUTH_EVENT } from "../HeaderNav";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({
    email: "student@med.local",
    password: "Password123!",
    firstName: "",
    lastName: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
      } else {
        await register({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
        });
      }
      window.dispatchEvent(new Event(AUTH_EVENT));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Что-то пошло не так");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>{mode === "login" ? "Войти" : "Создать аккаунт"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  name="firstName"
                  label="Имя"
                  value={form.firstName}
                  onChange={update("firstName")}
                  required
                />
                <Input
                  name="lastName"
                  label="Фамилия"
                  value={form.lastName}
                  onChange={update("lastName")}
                  required
                />
              </div>
            )}
            <Input
              name="email"
              type="email"
              label="Эл. почта"
              value={form.email}
              onChange={update("email")}
              required
            />
            <Input
              name="password"
              type="password"
              label="Пароль"
              value={form.password}
              onChange={update("password")}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" isLoading={loading}>
              {mode === "login" ? "Войти" : "Создать аккаунт"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            {mode === "login" ? "Ещё нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <button
              type="button"
              className="font-medium text-brand-600 hover:underline"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Зарегистрироваться" : "Войти"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
