import {createFileRoute} from "@tanstack/react-router";
import {useEffect,useRef} from "react";
import {layout} from "../companion/layout";
import {mountCompanion} from "../companion/app.mjs";
import {companionService} from "../services/companionService";
export const Route=createFileRoute("/")({component:Companion});
function Companion(){const host=useRef<HTMLDivElement>(null);useEffect(()=>{const element=host.current;if(!element)return;element.innerHTML=layout;const dispose=mountCompanion(companionService);return()=>{dispose();element.replaceChildren();};},[]);return <div ref={host}/>;}
