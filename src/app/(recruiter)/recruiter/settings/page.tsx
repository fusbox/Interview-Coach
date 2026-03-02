"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/cn";

// --- Types ---
interface RecruiterProfile {
    recruiter_id: string;
    first_name: string;
    last_name: string;
    title: string;
    phone: string;
    timezone: string;
}

// --- Timezone Helper ---
const getTimezones = () => {
    try {
        const zones = Intl.supportedValuesOf('timeZone');
        const mapped = zones.map(zone => {
            try {
                const short = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts().find(p => p.type === 'timeZoneName')?.value || 'GMT';
                const long = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'long' }).formatToParts().find(p => p.type === 'timeZoneName')?.value || zone;

                // Calculate offset for sorting
                let offset = 0;
                if (short !== 'GMT') {
                    const match = short.match(/GMT([+-])(\d+)(?::(\d+))?/);
                    if (match) {
                        const [, sign, h, m] = match;
                        const hours = parseInt(h, 10);
                        const mins = m ? parseInt(m, 10) : 0;
                        const total = hours * 60 + mins;
                        offset = sign === '-' ? -total : total;
                    }
                }

                return { value: zone, label: `(${short}) ${long} - ${zone}`, offset };
            } catch {
                return { value: zone, label: zone, offset: 0 };
            }
        });

        return mapped.sort((a, b) => {
            if (a.offset !== b.offset) return a.offset - b.offset;
            return a.label.localeCompare(b.label);
        }).map(({ value, label }) => ({ value, label }));
    } catch {
        // Fallback for older environments
        return [
            { value: "UTC", label: "UTC" },
            { value: "America/New_York", label: "Eastern Time (US & Canada)" },
            { value: "America/Chicago", label: "Central Time (US & Canada)" },
            { value: "America/Denver", label: "Mountain Time (US & Canada)" },
            { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
            { value: "Europe/London", label: "London" },
            // Add more as needed
        ];
    }
};

const TIMEZONES = getTimezones();

export default function SettingsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Initial state (from DB)
    const [initialProfile, setInitialProfile] = useState<RecruiterProfile | null>(null);

    // Working state (User inputs)
    const [profile, setProfile] = useState<RecruiterProfile>({
        recruiter_id: "",
        first_name: "",
        last_name: "",
        title: "",
        phone: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    });

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // --- Fetch Logic ---
    useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true);
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) {
                router.push("/login");
                return;
            }

            // Fetch existing profile
            const { data, error } = await supabase
                .from('recruiter_profiles')
                .select('*')
                .eq('recruiter_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = JSON object requested, multiple (or no) rows returned
                console.error("Error fetching profile:", error);
                setError("Failed to load profile.");
            } else if (data) {
                // Found
                const cleanData = {
                    recruiter_id: user.id,
                    first_name: data.first_name || "",
                    last_name: data.last_name || "",
                    title: data.title || "",
                    phone: data.phone || "",
                    timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
                };
                setInitialProfile(cleanData);
                setProfile(cleanData);
            } else {
                // Not found (First Run)
                // We initialize with empty strings but valid ID
                // No existing initialProfile to compare against yet? Or treat as empty?
                // Let's treat initial as empty so "Save" is active if they typed anything.
                const emptyProfile = {
                    recruiter_id: user.id,
                    first_name: "",
                    last_name: "",
                    title: "",
                    phone: "",
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
                };
                setInitialProfile(emptyProfile);
                setProfile(emptyProfile);

                // Pre-fill email from auth? Profile doesn't store email, Sidebar uses auth email.
            }
            setIsLoading(false);
        };

        fetchProfile();
    }, [router, supabase]);


    // --- Dirty Check ---
    const isDirty = initialProfile && JSON.stringify(profile) !== JSON.stringify(initialProfile);

    // --- Actions ---

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isDirty) return;

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // Upsert
            const { error } = await supabase
                .from('recruiter_profiles')
                .upsert({
                    recruiter_id: profile.recruiter_id,
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                    title: profile.title,
                    phone: profile.phone,
                    timezone: profile.timezone,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            // Update initial state to match new state
            setInitialProfile({ ...profile });
            setSuccessMessage("Profile updated successfully.");

            // Clear success message after 3s
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : "Failed to save profile.";
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        if (initialProfile) {
            setProfile({ ...initialProfile });
            setError(null);
            setSuccessMessage(null);
        }
    };

    // --- Render ---

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Account Settings</h1>
                <p className="text-slate-500">Manage your profile and display preferences.</p>
            </div>

            <form onSubmit={handleSave}>
                <Card className="border-t-4 border-t-primary shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle>Profile Details</CardTitle>
                        <CardDescription>
                            Your name and contact information will appear on candidate invites and emails.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100 flex items-start gap-2">
                                <span>⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}
                        {successMessage && !isDirty && (
                            <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-md border border-emerald-100 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                <span>✓</span>
                                <span>{successMessage}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Your Job Title</label>
                            <input
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 focus:border-primary focus:ring-primary/20 transition-all"
                                value={profile.title}
                                onChange={e => setProfile({ ...profile, title: e.target.value })}
                                placeholder="e.g. Senior Technical Recruiter"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">First Name</label>
                                <input
                                    required
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 focus:border-primary focus:ring-primary/20 transition-all"
                                    value={profile.first_name}
                                    onChange={e => setProfile({ ...profile, first_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Last Name</label>
                                <input
                                    required
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 focus:border-primary focus:ring-primary/20 transition-all"
                                    value={profile.last_name}
                                    onChange={e => setProfile({ ...profile, last_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Phone Number</label>
                            <input
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 focus:border-primary focus:ring-primary/20 transition-all"
                                value={profile.phone}
                                onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                type="tel"
                                placeholder="(555) 123-4567"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Display Time Zone</label>
                            <div className="relative">
                                {/* Custom Styled Select */}
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none focus:border-primary focus:ring-primary/20 transition-all cursor-pointer"
                                    value={profile.timezone}
                                    onChange={e => setProfile({ ...profile, timezone: e.target.value })}
                                >
                                    {TIMEZONES.map(tz => (
                                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">Used for displaying session timestamps and activity logs.</p>
                        </div>

                    </CardContent>
                    <CardFooter className="flex justify-between items-center bg-slate-50/50 p-4 border-t">
                        <div className="text-xs text-slate-400">
                            {isDirty ? "Unsaved changes" : "All changes saved"}
                        </div>
                        <div className="flex gap-3">
                            {isDirty && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCancel}
                                    className="animate-in fade-in slide-in-from-right-1 duration-200"
                                >
                                    Cancel
                                </Button>
                            )}
                            <Button
                                type="submit"
                                disabled={!isDirty || isSaving}
                                className={cn(
                                    "transition-all duration-300 min-w-[100px]",
                                    isDirty ? "bg-primary hover:bg-primary/90 shadow-md" : "opacity-70 bg-slate-300 text-slate-500 hover:bg-slate-300 cursor-not-allowed"
                                )}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" /> Save
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
