import { getAdminSession } from '@/lib/auth/session'
import { findSavedSearches } from '@/lib/aspire/queries'
import type { ApolloSearchFilters } from '@/lib/aspire/types'
import { db } from '@/lib/db/client'
import { aspireSavedSearches } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const data = await findSavedSearches(session.accountId)
  return NextResponse.json({ success: true, data })
}

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    name: string
    filters: ApolloSearchFilters
    runFrequency?: string
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
  }

  const [row] = await db
    .insert(aspireSavedSearches)
    .values({
      accountId: session.accountId,
      name: body.name.trim(),
      filters: body.filters ?? {},
      runFrequency: body.runFrequency ?? 'weekly',
      createdByUserId: session.userId,
    })
    .returning()

  return NextResponse.json({ success: true, data: row }, { status: 201 })
}

export async function PATCH(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    id: string
    name?: string
    filters?: ApolloSearchFilters
    runFrequency?: string
    isActive?: boolean
  }

  if (!body.id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
  }

  const [row] = await db
    .update(aspireSavedSearches)
    .set({
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.filters ? { filters: body.filters } : {}),
      ...(body.runFrequency ? { runFrequency: body.runFrequency } : {}),
      ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aspireSavedSearches.id, body.id),
        eq(aspireSavedSearches.accountId, session.accountId),
        isNull(aspireSavedSearches.deletedAt),
      ),
    )
    .returning()

  if (!row) {
    return NextResponse.json({ success: false, error: 'Search not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: row })
}

export async function DELETE(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
  }

  const [row] = await db
    .update(aspireSavedSearches)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(aspireSavedSearches.id, id),
        eq(aspireSavedSearches.accountId, session.accountId),
        isNull(aspireSavedSearches.deletedAt),
      ),
    )
    .returning({ id: aspireSavedSearches.id })

  if (!row) {
    return NextResponse.json({ success: false, error: 'Search not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: { id: row.id } })
}
