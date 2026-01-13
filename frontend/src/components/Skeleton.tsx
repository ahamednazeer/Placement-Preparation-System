'use client';

import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'heading' | 'card' | 'circle';
}

export default function Skeleton({ className = '', variant = 'text' }: SkeletonProps) {
    const variants = {
        text: 'skeleton-text',
        heading: 'skeleton-heading',
        card: 'skeleton-card',
        circle: 'h-12 w-12 rounded-full',
    };

    return (
        <div className={`skeleton ${variants[variant]} ${className}`} />
    );
}
