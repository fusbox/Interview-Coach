"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileSidebarProps {
    children: React.ReactNode;
}

export function MobileSidebar({ children }: MobileSidebarProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="md:hidden fixed top-4 left-4 z-50"
                onClick={() => setIsOpen(true)}
            >
                <Menu size={24} />
            </Button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 z-40 md:hidden"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Drawer */}
                        <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", damping: 20, stiffness: 300 }}
                            className="fixed inset-y-0 left-0 z-50 w-3/4 max-w-sm bg-white shadow-xl md:hidden"
                        >
                            <div className="relative h-full">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-4 right-4 z-50 text-muted-foreground"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X size={20} />
                                </Button>
                                {/* 
                                   Modify functionality: 
                                   We render children here. If children have interactive elements 
                                   that should close the sidebar, we might need a context or prop.
                                   For this implementation, we will perform a cloneElement to inject onNavigate 
                                   if the child supports it, or just wrap it.
                                */}
                                {React.Children.map(children, child => {
                                    if (React.isValidElement(child)) {
                                        return React.cloneElement(child, { onNavigate: () => setIsOpen(false) } as Record<string, unknown>);
                                    }
                                    return child;
                                })}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
