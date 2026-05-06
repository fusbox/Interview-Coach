"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, UserPlus, LogIn, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { AlertPanel } from "@/components/patterns/AlertPanel";
import { e2eRecruiterCookie, isClientE2EMode } from "@/lib/e2e/test-mode";

export default function LoginPage() {
    const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const router = useRouter();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (isClientE2EMode()) {
                if (activeTab === 'login') {
                    document.cookie = `${e2eRecruiterCookie.name}=${e2eRecruiterCookie.value}; path=/; SameSite=Lax`;
                    router.push("/recruiter/create");
                    router.refresh();
                } else {
                    setSuccessMessage("Check your email for the confirmation link!");
                    setEmail("");
                    setPassword("");
                }
                return;
            }

            if (activeTab === 'signup') {
                setSuccessMessage("Account creation is not available in this migration build yet. Please ask an administrator to create your account.");
                setPassword("");
                return;
            }

            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    password,
                }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(body.message || "Authentication failed");
            }

            router.push("/recruiter/create");
            router.refresh();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 font-sans relative overflow-hidden bg-background">
            {/* Background Aesthetic */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-brand-glass-start/30 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px]" />
            </div>

            <Card className="w-full max-w-md overflow-hidden border-border shadow-raised-2 bg-surface-base/80 backdrop-blur-md relative z-10 rounded-2xl">
                <CardHeader className="text-center pb-4 pt-8">
                    <CardTitle className="text-2xl font-semibold text-text-primary font-display">Recruiter Portal</CardTitle>
                    <CardDescription className="text-text-muted">Manage your interview sessions and candidates</CardDescription>
                </CardHeader>

                {/* Tabs */}
                <div className="px-5 md:px-8 pb-2">
                    <div className="grid grid-cols-2 bg-surface-subtle p-1 rounded-xl border border-border/40">
                        <button
                            onClick={() => { setActiveTab('login'); setError(null); setSuccessMessage(null); }}
                            className={cn(
                                "py-2.5 text-[9px] md:text-xs font-bold uppercase tracking-wider md:tracking-widest rounded-lg transition-all duration-base flex items-center justify-center gap-1.5 whitespace-nowrap",
                                activeTab === 'login'
                                    ? "bg-surface-base text-primary shadow-flat"
                                    : "text-text-disabled hover:text-text-secondary"
                            )}
                        >
                            <LogIn className="w-3.5 h-3.5" strokeWidth={2.5} /> Sign In
                        </button>
                        <button
                            onClick={() => { setActiveTab('signup'); setError(null); setSuccessMessage(null); }}
                            className={cn(
                                "py-2.5 text-[9px] md:text-xs font-bold uppercase tracking-wider md:tracking-widest rounded-lg transition-all duration-base flex items-center justify-center gap-1.5 whitespace-nowrap",
                                activeTab === 'signup'
                                    ? "bg-surface-base text-primary shadow-flat"
                                    : "text-text-disabled hover:text-text-secondary"
                            )}
                        >
                            <UserPlus className="w-3.5 h-3.5" strokeWidth={2.5} /> Create Account
                        </button>
                    </div>
                </div>

                <CardContent className="px-8 pb-8 pt-6">
                    <form onSubmit={handleAuth} className="space-y-5">
                        {error && (
                            <AlertPanel tone="critical" size="sm" icon={<AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />} className="animate-in fade-in slide-in-from-top-2">
                                <span className="font-medium">{error}</span>
                            </AlertPanel>
                        )}
                        {successMessage && (
                            <AlertPanel tone="success" size="sm" icon={<CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />} className="animate-in fade-in slide-in-from-top-2">
                                <span className="font-medium">{successMessage}</span>
                            </AlertPanel>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="email" className="text-micro font-bold uppercase tracking-widest text-text-muted ml-1">
                                Email Address
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-disabled group-focus-within:text-primary transition-colors h-4 w-4" />
                                <input
                                    required
                                    id="email"
                                    name="email"
                                    className="w-full h-11 pl-11 pr-4 rounded-xl border border-border bg-surface-subtle/30 focus:bg-surface-base focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all duration-base placeholder:text-text-disabled text-sm text-text-primary"
                                    placeholder="name@company.com"
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-micro font-bold uppercase tracking-widest text-text-muted ml-1">
                                Password
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-disabled group-focus-within:text-primary transition-colors h-4 w-4" />
                                <input
                                    required
                                    id="password"
                                    name="password"
                                    className="w-full h-11 pl-11 pr-11 rounded-xl border border-border bg-surface-subtle/30 focus:bg-surface-base focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all duration-base placeholder:text-text-disabled text-sm text-text-primary"
                                    placeholder={activeTab === 'signup' ? "Create a strong password" : "Enter your password"}
                                    type={showPassword ? "text" : "password"}
                                    autoComplete={activeTab === 'signup' ? "new-password" : "current-password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-primary focus:outline-none transition-colors"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    aria-pressed={showPassword}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button className="w-full h-11 rounded-xl font-bold shadow-flat hover:shadow-raised-1 hover:bg-primary/90 transition-all duration-base ease-emphasized active:scale-[0.98]" type="submit" disabled={loading}>
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
                                <a href="#" className="text-xs text-text-muted hover:text-primary hover:underline font-bold transition-colors">
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
