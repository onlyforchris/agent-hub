import React, { useState } from "react";
import { useAuth } from "./auth.tsx";

interface CaptchaData {
  captchaId: string;
  imageBase64: string;
  expiresIn: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
}

function toCaptchaImageSrc(raw: string): string {
  if (!raw) return "";
  return raw.startsWith("data:image/") ? raw : `data:image/png;base64,${raw}`;
}

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null);
  const [captchaCode, setCaptchaCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadCaptcha = async () => {
    const resp = await fetch("/api/auth/captcha");
    const text = await resp.text();
    let json: ApiEnvelope<CaptchaData> | null = null;
    try {
      json = JSON.parse(text) as ApiEnvelope<CaptchaData>;
    } catch {
      json = null;
    }
    if (!resp.ok) {
      throw new Error(json?.message || `验证码接口异常 (HTTP ${resp.status})`);
    }
    if (!json?.success || !json.data) {
      throw new Error(json?.message || "验证码接口返回非 JSON 或数据格式不正确");
    }
    setCaptcha(json.data);
  };

  React.useEffect(() => {
    void loadCaptcha().catch((e) => setError(e instanceof Error ? e.message : "验证码加载失败"));
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!captcha?.captchaId || !captchaCode.trim()) {
      setError("请输入验证码");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await login(username, password, captcha.captchaId, captchaCode.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      void loadCaptcha().catch(() => undefined);
      setCaptchaCode("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Agent Hub Login</h1>
        <p className="mt-1 text-sm text-slate-500">Use admin/admin123 or finance/finance123</p>
        <label className="mt-5 block text-sm text-slate-700">
          Username
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm text-slate-700">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm text-slate-700">
          Captcha
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            value={captchaCode}
            onChange={(e) => setCaptchaCode(e.target.value)}
            placeholder="请输入验证码"
          />
        </label>
        <div className="mt-3 flex items-center gap-3">
          {captcha?.imageBase64 ? (
            <img
              src={toCaptchaImageSrc(captcha.imageBase64)}
              alt="captcha"
              className="h-10 w-28 rounded border border-slate-200 bg-white object-contain"
            />
          ) : (
            <div className="h-10 w-28 rounded border border-slate-200 bg-slate-50" />
          )}
          <button type="button" onClick={() => void loadCaptcha()} className="text-sm text-blue-600 hover:text-blue-700">
            看不清，换一张
          </button>
        </div>
        {error ? <div className="mt-3 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
