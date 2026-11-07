// The address a parent forwards a child's school email to.
//
// First name at the inbound domain — jaxon@in.morrisai.family — which is what
// a parent can remember and type. When two children in the household share a
// first name, the start of the child's id is added so the door can tell them
// apart; app/api/email/inbound accepts both forms.

export function inboundAddressFor(
  childId: string,
  childName: string,
  siblings: { childId: string; name: string }[],
  domain: string,
): string {
  const first = (childName.split(/\s+/)[0] ?? "child").toLowerCase().replace(/[^a-z0-9]/g, "") || "child";
  const clash = siblings.some((s) => s.childId !== childId && (s.name.split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") === first);
  return `${first}${clash ? `-${childId.replace(/-/g, "").slice(0, 8)}` : ""}@${domain.toLowerCase()}`;
}
