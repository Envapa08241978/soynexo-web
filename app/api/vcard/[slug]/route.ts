import { NextRequest, NextResponse } from 'next/server'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function GET(
    request: NextRequest,
    { params }: { params: { slug: string } }
) {
    const slug = params.slug

    try {
        // Try to load politician config from Firebase
        const configDoc = await getDoc(doc(db, 'politicians', slug, 'config', 'profile'))
        let name = 'Juan Pérez'
        let phone = '+526421600559'
        let org = ''
        let title = ''

        if (configDoc.exists()) {
            const data = configDoc.data()
            name = data.name || name
            phone = data.phone || phone
            org = data.party || ''
            title = data.title || ''
        }

        // Ensure phone has +52 prefix
        const formattedPhone = phone.startsWith('+') ? phone : `+52${phone}`

        const vcard = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${name}`,
            `TEL;TYPE=CELL:${formattedPhone}`,
            org ? `ORG:${org}` : '',
            title ? `TITLE:${title}` : '',
            'END:VCARD',
        ].filter(Boolean).join('\r\n')

        return new NextResponse(vcard, {
            status: 200,
            headers: {
                'Content-Type': 'text/vcard; charset=utf-8',
                'Content-Disposition': `attachment; filename="${slug}.vcf"`,
            },
        })
    } catch (error) {
        console.error('vCard generation error:', error)
        // Fallback vCard
        const vcard = `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Contacto\r\nTEL;TYPE=CELL:+526421600559\r\nEND:VCARD`
        return new NextResponse(vcard, {
            status: 200,
            headers: {
                'Content-Type': 'text/vcard; charset=utf-8',
                'Content-Disposition': `attachment; filename="${slug}.vcf"`,
            },
        })
    }
}
