import { supabase } from "./supabase";

export type Role = "client" | "muqeeb";
export type TStatus = "pending_payment" | "paid";

export interface Taameed { id: string; conversationId: string; title: string; terms: string; amount: number; date: string; status: TStatus }
export interface MsgAttachment { name: string; path: string; mimeType: string; size: number }
export interface Msg { id: string; conversationId: string; from: Role | "system"; text?: string; taameedId?: string; time: string; attachment?: MsgAttachment }
export interface OfferRow { id: string; requestId: string; muqeeb: string; rating: number; price: number; days: number; note: string }
export interface RequestRow { id: string; title: string; sector: string; desc: string; bids: number; budget: string }
export interface ConversationRow { id: string; requestId: string; title: string; clientName: string; providerName: string; lastMessage: string; time: string }

interface RequestDb { id: string; title: string; sector: string; description: string; bids: number; budget: string }
interface OfferDb { id: string; request_id: string; muqeeb: string; rating: number; price: number; days: number; note: string }
interface ConversationDb { id: string; request_id: string; title: string; client_name: string; provider_name: string; last_message: string; last_message_time: string }
interface MessageDb { id: string; conversation_id: string; sender: string; text: string | null; taameed_id: string | null; display_time: string; attachment_path: string | null; attachment_name: string | null; attachment_mimetype: string | null; attachment_size: number | null }
interface TaameedDb { id: string; conversation_id: string; title: string; terms: string; amount: number; date: string; status: TStatus }

const mapRequest = (r: RequestDb): RequestRow => ({ id: r.id, title: r.title, sector: r.sector, desc: r.description, bids: r.bids, budget: r.budget });
const mapOffer = (o: OfferDb): OfferRow => ({ id: o.id, requestId: o.request_id, muqeeb: o.muqeeb, rating: Number(o.rating), price: o.price, days: o.days, note: o.note });
const mapConversation = (c: ConversationDb): ConversationRow => ({ id: c.id, requestId: c.request_id, title: c.title, clientName: c.client_name, providerName: c.provider_name, lastMessage: c.last_message, time: c.last_message_time });
const mapMessage = (m: MessageDb): Msg => ({ id: m.id, conversationId: m.conversation_id, from: m.sender as Role | "system", text: m.text ?? undefined, taameedId: m.taameed_id ?? undefined, time: m.display_time, attachment: m.attachment_path ? { name: m.attachment_name ?? "", path: m.attachment_path, mimeType: m.attachment_mimetype ?? "application/octet-stream", size: m.attachment_size ?? 0 } : undefined });
const mapTaameed = (t: TaameedDb): Taameed => ({ id: t.id, conversationId: t.conversation_id, title: t.title, terms: t.terms, amount: Number(t.amount), date: t.date, status: t.status });

export async function fetchRequests(): Promise<RequestRow[]> {
  const { data, error } = await supabase.from("requests").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRequest);
}

export async function fetchOffersByRequest(requestId: string): Promise<OfferRow[]> {
  const { data, error } = await supabase.from("offers").select("*").eq("request_id", requestId).order("price", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapOffer);
}

export async function fetchAllOffers(): Promise<OfferRow[]> {
  const { data, error } = await supabase.from("offers").select("*");
  if (error) throw error;
  return (data ?? []).map(mapOffer);
}

export async function fetchConversations(): Promise<ConversationRow[]> {
  const { data, error } = await supabase.from("conversations").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapConversation);
}

export async function fetchMessages(conversationId: string): Promise<Msg[]> {
  const { data, error } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapMessage);
}

export async function fetchTaameeds(): Promise<Taameed[]> {
  const { data, error } = await supabase.from("taameeds").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapTaameed);
}

export async function fetchTaameedsByConversation(conversationId: string): Promise<Taameed[]> {
  const { data, error } = await supabase.from("taameeds").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapTaameed);
}

export async function insertRequest(row: { id: string; title: string; sector: string; description: string; bids: number; budget: string }): Promise<void> {
  const { error } = await supabase.from("requests").insert({ id: row.id, title: row.title, sector: row.sector, description: row.description, bids: row.bids, budget: row.budget });
  if (error) throw error;
}

export async function insertConversation(row: { id: string; request_id: string; title: string; client_name: string; provider_name: string; last_message: string; last_message_time: string }): Promise<void> {
  const { error } = await supabase.from("conversations").insert({ id: row.id, request_id: row.request_id, title: row.title, client_name: row.client_name, provider_name: row.provider_name, last_message: row.last_message, last_message_time: row.last_message_time });
  if (error) throw error;
}

export async function updateConversationPreview(conversationId: string, lastMessage: string, lastMessageTime: string): Promise<void> {
  const { error } = await supabase.from("conversations").update({ last_message: lastMessage, last_message_time: lastMessageTime }).eq("id", conversationId);
  if (error) throw error;
}

export async function insertMessage(row: { id: string; conversation_id: string; sender: string; text: string | null; taameed_id: string | null; display_time: string; attachment_path?: string | null; attachment_name?: string | null; attachment_mimetype?: string | null; attachment_size?: number | null }): Promise<void> {
  const { error } = await supabase.from("messages").insert({ id: row.id, conversation_id: row.conversation_id, sender: row.sender, text: row.text, taameed_id: row.taameed_id, display_time: row.display_time, attachment_path: row.attachment_path ?? null, attachment_name: row.attachment_name ?? null, attachment_mimetype: row.attachment_mimetype ?? null, attachment_size: row.attachment_size ?? null });
  if (error) throw error;
}

export async function insertTaameed(row: { id: string; conversation_id: string; title: string; terms: string; amount: number; date: string; status: TStatus }): Promise<void> {
  const { error } = await supabase.from("taameeds").insert({ id: row.id, conversation_id: row.conversation_id, title: row.title, terms: row.terms, amount: row.amount, date: row.date, status: row.status });
  if (error) throw error;
}

export async function updateTaameedStatus(id: string, status: TStatus): Promise<void> {
  const { error } = await supabase.from("taameeds").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteTaameedsByConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.from("taameeds").delete().eq("conversation_id", conversationId);
  if (error) throw error;
}

export async function insertOffer(row: { id: string; request_id: string; muqeeb: string; rating: number; price: number; days: number; note: string }): Promise<void> {
  const { error } = await supabase.from("offers").insert({ id: row.id, request_id: row.request_id, muqeeb: row.muqeeb, rating: row.rating, price: row.price, days: row.days, note: row.note });
  if (error) throw error;
}

export async function incrementRequestBids(requestId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_request_bids", { req_id: requestId });
  if (error && error.code !== "P0001") throw error;
}

export async function insertDispute(conversationId: string): Promise<void> {
  const { error } = await supabase.from("disputes").insert({ conversation_id: conversationId });
  if (error && error.code !== "23505") throw error;
}

export async function fetchDispute(conversationId: string): Promise<boolean> {
  const { data, error } = await supabase.from("disputes").select("conversation_id").eq("conversation_id", conversationId).maybeSingle();
  if (error) return false;
  return !!data;
}
