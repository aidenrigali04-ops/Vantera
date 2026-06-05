import { NextResponse } from 'next/server'

const ALLOW_HEADERS = 'Authorization, Content-Type'

export function extensionCorsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
  }
}

export function extensionOptionsResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: extensionCorsHeaders() })
}

export function extensionJsonResponse(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: extensionCorsHeaders(),
  })
}
