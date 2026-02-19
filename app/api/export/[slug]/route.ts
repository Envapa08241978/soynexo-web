import { NextRequest, NextResponse } from 'next/server'
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function GET(
    request: NextRequest,
    { params }: { params: { slug: string } }
) {
    const slug = params.slug
    const { searchParams } = new URL(request.url)
    const eventFilter = searchParams.get('event')
    const coloniaFilter = searchParams.get('colonia')
    const format = searchParams.get('format') || 'google' // 'google' or 'excel'

    try {
        const contactsRef = collection(db, 'politicians', slug, 'contacts')
        let q = query(contactsRef, orderBy('timestamp', 'desc'))

        const snapshot = await getDocs(q)
        let contacts = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        })) as any[]

        // Apply filters client-side (Firestore limitation on multiple inequality)
        if (eventFilter) {
            contacts = contacts.filter(c => c.eventId === eventFilter)
        }
        if (coloniaFilter) {
            contacts = contacts.filter(c => c.colonia === coloniaFilter)
        }

        if (format === 'google') {
            // Google Contacts CSV format
            // Google Contacts CSV format
            // Key behavior: 'Group Membership' -> '* myContacts' ensures they appear in main list on mobile
            const header = 'Name,Phone 1 - Value,Phone 1 - Type,Organization 1 - Name,Notes,Group Membership'
            const rows = contacts.map(c => {
                if (!c.phone) return ''
                const cleanPhone = c.phone.replace(/\D/g, '')
                const phone = cleanPhone.length === 10 ? `+52${cleanPhone}` : c.phone

                const notes = [
                    c.eventName ? `Evento: ${c.eventName}` : '',
                    c.colonia ? `Colonia: ${c.colonia}` : '',
                ].filter(Boolean).join(' | ')

                // Escape quotes in name/notes if necessary (simple approach)
                const safeName = (c.name || '').replace(/"/g, '""')
                const safeEvent = (c.eventName || '').replace(/"/g, '""')

                return `"${safeName}","${phone}","Mobile","${safeEvent}","${notes}","* myContacts"`
            }).filter(Boolean)
            const csv = [header, ...rows].join('\r\n')

            return new NextResponse(csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="contactos-${slug}.csv"`,
                },
            })
        } else {
            // Excel-compatible CSV
            const bom = '\uFEFF' // BOM for Excel UTF-8
            const header = 'Nombre,Teléfono,Evento,Colonia,Fecha'
            const rows = contacts.map(c => {
                const phone = c.phone?.startsWith('+') ? c.phone : `+52${c.phone}`
                const date = c.timestamp?.toDate?.()
                    ? c.timestamp.toDate().toLocaleDateString('es-MX')
                    : ''
                return `"${c.name || ''}","${phone}","${c.eventName || ''}","${c.colonia || ''}","${date}"`
            })
            const csv = bom + [header, ...rows].join('\r\n')

            return new NextResponse(csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="contactos-${slug}.csv"`,
                },
            })
        }
    } catch (error) {
        console.error('Export error:', error)
        return NextResponse.json({ error: 'Error exporting contacts' }, { status: 500 })
    }
}
