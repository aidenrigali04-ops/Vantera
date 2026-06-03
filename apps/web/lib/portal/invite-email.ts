type PortalInviteEmailInput = {
  contactName: string
  accountName: string
  portalUrl: string
  magicLink: string
  primaryColor: string
  logoUrl: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HTML invite body — uses workspace name, colors, and logo (no Vantera branding). */
export function buildPortalInviteEmailHtml(input: PortalInviteEmailInput): string {
  const accountName = escapeHtml(input.accountName)
  const contactName = escapeHtml(input.contactName)
  const primary = escapeHtml(input.primaryColor)
  const portalUrl = escapeHtml(input.portalUrl)
  const magicLink = escapeHtml(input.magicLink)

  const headerLogo = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${accountName}" height="36" style="display:block;max-width:180px;object-fit:contain" />`
    : `<p style="margin:0;font-size:18px;font-weight:600;color:#0f172a">${accountName}</p>`

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a">
      <div style="margin-bottom:24px">${headerLogo}</div>
      <h1 style="font-size:20px;margin:0 0 12px;font-weight:600">Your client portal is ready</h1>
      <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 24px">
        Hi ${contactName}, ${accountName} has invited you to your client portal.
        View project progress, documents, invoices, and message your team in one place.
      </p>
      <p style="margin:0 0 32px">
        <a href="${magicLink}"
           style="background:${primary};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:500;display:inline-block">
          Open client portal
        </a>
      </p>
      <p style="font-size:12px;color:#64748b;margin:0">
        Portal URL: <span style="word-break:break-all">${portalUrl}</span><br /><br />
        If the button doesn&apos;t work, copy this link into your browser:<br />
        <span style="word-break:break-all">${magicLink}</span>
      </p>
    </div>
  `.trim()
}
