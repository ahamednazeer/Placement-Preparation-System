import DashboardLayout from '@/components/DashboardLayout';

export default function OfficerDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayout>{children}</DashboardLayout>;
}
