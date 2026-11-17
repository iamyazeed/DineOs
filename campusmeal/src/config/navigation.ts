import type { IconName } from "@/components/ui/icon";
import type { Role } from "@/types/domain";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: Record<Role, NavGroup[]> = {
  super_admin: [
    {
      label: "University",
      items: [
        { href: "/super-admin", label: "University Overview", icon: "home" },
        { href: "/super-admin/institutions", label: "Institutions", icon: "building" },
        { href: "/super-admin/analytics", label: "Institutional Analytics", icon: "chart" },
        { href: "/super-admin/reports", label: "Meal Consumption Reports", icon: "file" },
        { href: "/super-admin/analytics/waste", label: "Food Waste Analytics", icon: "leaf" },
      ],
    },
    {
      label: "Coordination",
      items: [
        { href: "/super-admin/communication", label: "Institutional Communication", icon: "chat" },
        { href: "/super-admin/documents", label: "Document Exchange", icon: "file" },
        { href: "/super-admin/settings", label: "Platform Settings", icon: "settings" },
        { href: "/super-admin/audit-logs", label: "Audit Logs", icon: "shield" },
      ],
    },
  ],
  institution_admin: [
    {
      label: "Operations",
      items: [
        { href: "/admin", label: "Overview", icon: "home" },
        { href: "/admin/meals", label: "Daily Meals & Exceptions", icon: "calendar" },
        { href: "/admin/attendance", label: "Meal Attendance", icon: "check" },
        { href: "/admin/special-food", label: "Special Food Requests", icon: "star" },
        { href: "/admin/kitchen", label: "Kitchen Monitoring", icon: "flame" },
        { href: "/admin/distribution", label: "Distribution Monitoring", icon: "truck" },
        { href: "/admin/announcements", label: "Announcements", icon: "bell" },
        { href: "/admin/service-requests", label: "Service Requests", icon: "wrench" },
      ],
    },
    {
      label: "Configuration",
      items: [
        { href: "/admin/campus", label: "Campus Configuration", icon: "settings" },
        { href: "/admin/meals/timetable", label: "Meal Timetable", icon: "clock" },
        { href: "/admin/meals/menu", label: "Menu Management", icon: "menu" },
        { href: "/admin/students", label: "Students & Teachers", icon: "users" },
        { href: "/admin/classes", label: "Classes", icon: "grid" },
        { href: "/admin/dining/halls", label: "Dining Halls & Tables", icon: "seat" },
      ],
    },
    {
      label: "Insight",
      items: [
        { href: "/admin/analytics", label: "Reports & Analytics", icon: "chart" },
        { href: "/admin/communication", label: "University Communication", icon: "chat" },
      ],
    },
  ],
  chef: [
    {
      label: "Kitchen",
      items: [
        { href: "/chef", label: "Kitchen Overview", icon: "home" },
        { href: "/chef/meal-plan", label: "Today's Meal Plan", icon: "calendar" },
        { href: "/chef/counts", label: "Approved Meal Counts", icon: "check" },
        { href: "/chef/special-food", label: "Special Food Requests", icon: "star" },
        { href: "/chef/preparation", label: "Preparation Progress", icon: "flame" },
        { href: "/chef/quantities", label: "Table-wise Quantities", icon: "seat" },
      ],
    },
    {
      label: "Logistics",
      items: [
        { href: "/chef/delivery", label: "Delivery Status", icon: "truck" },
        { href: "/chef/distribution", label: "Distribution Status", icon: "grid" },
        { href: "/chef/ingredients", label: "Ingredient Usage", icon: "box" },
        { href: "/chef/shortages", label: "Stock Shortages", icon: "alert" },
        { href: "/chef/service-requests", label: "Kitchen Service Requests", icon: "wrench" },
      ],
    },
  ],
  teacher: [
    {
      label: "My classes",
      items: [
        { href: "/teacher", label: "Overview", icon: "home" },
        { href: "/teacher/meal-status", label: "Student Meal Status", icon: "users" },
        { href: "/teacher/attendance", label: "Class-wise Attendance", icon: "check" },
        { href: "/teacher/special-food", label: "Special Food Requests", icon: "star" },
      ],
    },
    {
      label: "Dining",
      items: [
        { href: "/teacher/tables", label: "All Campus Tables", icon: "seat" },
        { href: "/teacher/suppliers", label: "Supplier Rotation", icon: "history" },
        { href: "/teacher/suppliers/substitute", label: "Substitute Supplier", icon: "swap" },
        { href: "/teacher/distribution", label: "Table-wise Distribution", icon: "truck" },
        { href: "/teacher/reports", label: "Missing Meal Reports", icon: "alert" },
        { href: "/teacher/announcements", label: "Announcements", icon: "bell" },
      ],
    },
  ],
  student: [
    {
      label: "Meals",
      items: [
        { href: "/student", label: "Overview", icon: "home" },
        { href: "/student/menu", label: "Today's Menu", icon: "menu" },
        { href: "/student/timetable", label: "Weekly Meal Timetable", icon: "calendar" },
        { href: "/student/cancellation", label: "Cancel a Meal", icon: "x" },
        { href: "/student/my-table", label: "My Table", icon: "seat" },
        { href: "/student/announcements", label: "Announcements", icon: "bell" },
        { href: "/student/history", label: "My Meal History", icon: "history" },
      ],
    },
  ],
};
