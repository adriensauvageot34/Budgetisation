import { fixture as headlessFixture, state } from './planner-headless.mjs';
import { fixture as mobilityFixture, uuid, home, destination } from './planner-mobility.mjs';
export function p10Month() {
  const world = headlessFixture(); world.mobilityFacts = mobilityFixture().mobilityFacts;
  world.mobilityFacts.places = world.mobilityFacts.places.map(p => ({ ...p, name: p.placeId === destination.placeId ? 'Fontès fixture' : p.placeId === home.placeId ? 'Maison fixture' : p.name }));
  return { world, semantic: state() };
}
export const p10Route = () => ({ version:'composer-mobility-route@v1',
  vehicleRef:{vehicleId:uuid(9150),labelAtSelection:'Peugeot 207 fixture',provenance:'EXPLICIT_USER_DECISION'},
  stops:[{placeId:home.placeId,label:'Maison fixture',endpointSource:'DIRECT_PLACE'},
    {placeId:destination.placeId,label:'Fontès fixture',endpointSource:'ROOT_PLACE'},
    {placeId:home.placeId,label:'Maison fixture',endpointSource:'DIRECT_PLACE'}] });
