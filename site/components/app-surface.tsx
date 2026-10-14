'use client';
import {usePathname} from 'next/navigation';
import FamilyApp from './family-app';
import CareApp from './care-app';
export default function AppSurface(){const path=usePathname();return path==='/'||path==='/family'?<FamilyApp/>:<CareApp/>;}
