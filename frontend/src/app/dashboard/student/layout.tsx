import DashboardLayout from '@/components/DashboardLayout';

export default function StudentDashboardRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayout>{children}</DashboardLayout>;
}
