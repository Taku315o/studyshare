"use client";

import { useEffect } from "react";
import  supabase  from "@/lib/supabase";

export default function AuthCallbackPage() {
  useEffect(() => {
    // セッション確定を待って、好きな場所に飛ばす
    supabase.auth.getSession().then(() => {
      window.location.href = "/"; // 例: トップへ
    });
  }, []);

  return <div style={{ padding: 24 }}>Signing you in...</div>;
}
