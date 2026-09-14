import {z} from 'zod';

export const npcBehaviorSchema=z.object({
  movement:z.enum(['stationary','wander','patrol']),
  radius:z.number().int().min(1).max(3),
  intervalSeconds:z.number().int().min(2).max(8),
  waypoints:z.array(z.object({x:z.number().int().min(-3).max(3),y:z.number().int().min(-3).max(3)}).strict()).max(6),
}).strict();
export type NpcBehavior=z.infer<typeof npcBehaviorSchema>;
export const npcBehaviorBindingSchema=z.object({sceneId:z.enum(['outdoor','sanctuary','home']),npcId:z.string().min(1).max(48),behavior:npcBehaviorSchema}).strict();
export type NpcBehaviorBinding=z.infer<typeof npcBehaviorBindingSchema>;
export const interiorDesignSchema=z.object({
  sceneId:z.enum(['sanctuary','home']),name:z.string().min(3).max(48),
  furniture:z.array(z.object({
    kind:z.enum(['table','counter','bookcase','bed']),name:z.string().min(2).max(40),text:z.string().min(5).max(180),
    x:z.number().int().min(9).max(22),y:z.number().int().min(5).max(18),
    width:z.number().int().min(1).max(5),height:z.number().int().min(1).max(3),
  }).strict()).min(1).max(10),
  rugs:z.array(z.object({x:z.number().int().min(9).max(22),y:z.number().int().min(5).max(18),width:z.number().int().min(1).max(5),height:z.number().int().min(1).max(4)}).strict()).max(4),
}).strict();
export type InteriorDesign=z.infer<typeof interiorDesignSchema>;
export const npcPlanSchema=z.object({action:z.enum(['greet','guard','rest']),intention:z.string().min(1).max(180),dialogue:z.string().min(1).max(260),memory:z.string().min(1).max(200),behavior:npcBehaviorSchema.nullable().default(null)}).strict();
