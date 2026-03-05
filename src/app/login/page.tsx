"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, UserPlus, LogIn, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export default function LoginPage() {
    const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const router = useRouter();

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (activeTab === 'login') {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
                router.push("/recruiter/create");
                router.refresh();
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback?next=/recruiter/create`
                    }
                });
                if (error) throw error;
                setSuccessMessage("Check your email for the confirmation link!");
                setEmail("");
                setPassword("");
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-subtle p-4 font-sans">
            <Card className="w-full max-w-md overflow-hidden border-t-4 border-t-primary shadow-xl">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold text-slate-800">Recruiter Portal</CardTitle>
                    <CardDescription>Manage your interview sessions and candidates</CardDescription>
                </CardHeader>

                {/* Tabs */}
                <div className="px-6 pb-2">
                    <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => { setActiveTab('login'); setError(null); setSuccessMessage(null); }}
                            className={cn(
                                "py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2",
                                activeTab === 'login'
                                    ? "bg-white text-primary shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                            )}
                        >
                            <LogIn size={16} /> Sign In
                        </button>
                        <button
                            onClick={() => { setActiveTab('signup'); setError(null); setSuccessMessage(null); }}
                            className={cn(
                                "py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2",
                                activeTab === 'signup'
                                    ? "bg-white text-primary shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                            )}
                        >
                            <UserPlus size={16} /> Create Account
                        </button>
                    </div>
                </div>

                <CardContent className="pt-6">
                    <form onSubmit={handleAuth} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                <span className="mt-0.5">⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}
                        {successMessage && (
                            <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-md border border-emerald-100 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                <span className="mt-0.5">✓</span>
                                <span>{successMessage}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-micro font-semibold uppercase tracking-wider text-text-muted ml-1">
                                Email Address
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors h-4 w-4" />
                                <input
                                    required
                                    className="w-full h-10 pl-10 pr-3 rounded-md border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400 text-sm text-slate-900"
                                    placeholder="name@company.com"
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-micro font-semibold uppercase tracking-wider text-text-muted ml-1">
                                Password
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors h-4 w-4" />
                                <input
                                    required
                                    className="w-full h-10 pl-10 pr-10 rounded-md border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400 text-sm text-slate-900"
                                    placeholder={activeTab === 'signup' ? "Create a strong password" : "Enter your password"}
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button className="w-full font-bold shadow-md hover:shadow-lg transition-all" type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {activeTab === 'login' ? "Signing In..." : "Creating Account..."}
                                    </>
                                ) : (
                                    activeTab === 'login' ? "Sign In" : "Create Account"
                                )}
                            </Button>
                        </div>

                        {activeTab === 'login' && (
                            <div className="text-center pt-2">
                                <a href="#" className="text-xs text-primary hover:underline font-medium">
                                    Forgot your password?
                                </a>
                            </div>
                        )}
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
