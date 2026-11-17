import React from "react";
import {
  Users,
  Code2,
  Layers,
  Globe,
  Smartphone,
  PenTool,
  Cpu,
  Cloud,
  ShieldCheck,
  FlaskConical,
  BarChart3,
  Building2,
  Car,
  HeartPulse,
  ShoppingCart,
  Factory,
  Truck,
  GraduationCap,
  Plane,
  Landmark,
  Bell,
  Briefcase,
  Network,
  PhoneCall,
  BookOpen,
  Zap,
  Target,
  Award,
  Lock,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  users: Users,
  code: Code2,
  layers: Layers,
  globe: Globe,
  smartphone: Smartphone,
  pen: PenTool,
  cpu: Cpu,
  cloud: Cloud,
  shield: ShieldCheck,
  flask: FlaskConical,
  chart: BarChart3,
  building: Building2,
  car: Car,
  heart: HeartPulse,
  cart: ShoppingCart,
  factory: Factory,
  truck: Truck,
  grad: GraduationCap,
  plane: Plane,
  bank: Landmark,
  bell: Bell,
  briefcase: Briefcase,
  network: Network,
  phone: PhoneCall,
  book: BookOpen,
  zap: Zap,
  target: Target,
  award: Award,
  lock: Lock,
};

export function DynamicIcon({
  name,
  className = "h-5 w-5",
}: {
  name?: string | null;
  className?: string;
}) {
  const Icon = (name && ICON_MAP[name]) || Code2;
  return <Icon className={className} />;
}

