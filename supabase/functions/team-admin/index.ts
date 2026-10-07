// team-admin: HQ → Team access (admin only). Lists team logins and lets an admin set a password for a team member
// (creating the login if it doesn't exist, confirming the email, and adding the dashboard_access row).
// The service key stays here; the browser only sends the admin's JWT.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!, SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
const ROLES = ["admin", "ops"];

async function admin(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const userSb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await userSb.auth.getUser();
  if (!user) return null;
  const role = await userSb.rpc("dashboard_role");
  return role.data === "admin" ? user : null;
}

async function authUsers() {
  const out: any[] = [];
  for (let page = 1; page < 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const me = await admin(req); if (!me) return json({ ok: false, error: "Admins only." }, 403);
  let b: any = {}; try { b = await req.json(); } catch { return json({ ok: false, error: "bad request" }, 400); }

  try {
    if (b.action === "list") {
      const { data: access, error } = await sb.from("dashboard_access").select("email,role,full_name,created_at").in("role", ROLES).order("created_at");
      if (error) throw error;
      const users = await authUsers(), byEmail = new Map(users.map(u => [String(u.email || "").toLowerCase(), u]));
      return json({
        ok: true, members: (access || []).map(a => {
          const u: any = byEmail.get(a.email.toLowerCase());
          return { ...a, has_login: !!u, confirmed: !!u?.email_confirmed_at, invited_at: u?.invited_at || null, last_sign_in_at: u?.last_sign_in_at || null };
        }),
      });
    }

    if (b.action === "set_password") {
      const email = String(b.email || "").trim().toLowerCase(), password = String(b.password || "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "That email doesn't look right." }, 400);
      if (password.length < 8) return json({ ok: false, error: "Passwords need at least 8 characters." }, 400);

      // Access row: required to sign in to HQ. New members need a role.
      const { data: row } = await sb.from("dashboard_access").select("role").ilike("email", email).maybeSingle();
      if (!row) {
        if (!ROLES.includes(b.role)) return json({ ok: false, error: "Pick a role for the new member." }, 400);
        const ins = await sb.from("dashboard_access").insert({ email, role: b.role, full_name: String(b.full_name || "").trim() || null });
        if (ins.error) throw ins.error;
      } else if (!ROLES.includes(row.role)) {
        return json({ ok: false, error: `${email} is a partner (${row.role}) account, not a team account.` }, 400);
      }

      const u = (await authUsers()).find(x => String(x.email || "").toLowerCase() === email);
      const res = u
        ? await sb.auth.admin.updateUserById(u.id, { password, email_confirm: true })
        : await sb.auth.admin.createUser({ email, password, email_confirm: true });
      if (res.error) throw res.error;
      console.log(`team-admin: ${me.email} set password for ${email} (${u ? "existing" : "new"} login)`);
      return json({ ok: true, created: !u });
    }

    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message || String(e) }, 500);
  }
});
