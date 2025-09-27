import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

interface Product {
    id: string;
    name: string;
    basePrice: number;
}

const dataDir = path.join(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'products.json');

const DEFAULT_PRODUCTS: Product[] = [
    {
        id: 'B0F6PD51CY',
        name: 'WISHKEY 145 Pieces Art Set',
        basePrice: 10180000
    },
    {
        id: 'MACBOOK',
        name: 'MacBook Pro M3',
        basePrice: 2499000000
    },
    {
        id: 'IPADAIR',
        name: 'iPad Air',
        basePrice: 599000000
    },
    {
        id: 'GALAXY24',
        name: 'Samsung Galaxy S24',
        basePrice: 999000000
    },
    {
        id: 'XPSLAPTOP',
        name: 'Dell XPS 15',
        basePrice: 1899000000
    },
    {
        id: 'SONYTVX90',
        name: 'Sony X90L TV',
        basePrice: 1299000000
    },
    {
        id: 'AIRPODS',
        name: 'AirPods Pro',
        basePrice: 249000000
    },
    {
        id: 'SWITCH',
        name: 'Nintendo Switch OLED',
        basePrice: 349000000
    }
];

async function ensureDataFile(): Promise<void> {
    try {
        await fs.access(dataFile);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(dataFile, JSON.stringify(DEFAULT_PRODUCTS, null, 2), 'utf8');
    }
}

async function readProducts(): Promise<Product[]> {
    await ensureDataFile();
    const raw = await fs.readFile(dataFile, 'utf8');
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed as Product[];
        }
        return DEFAULT_PRODUCTS;
    } catch {
        return DEFAULT_PRODUCTS;
    }
}

async function writeProducts(products: Product[]): Promise<void> {
    await fs.writeFile(dataFile, JSON.stringify(products, null, 2), 'utf8');
}

function setCorsHeaders(res: NextApiResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method === 'GET') {
        try {
            const products = await readProducts();
            res.status(200).json(products);
            return;
        } catch (error) {
            console.error('Failed to read products.json:', error);
            res.status(500).json({ error: 'Failed to load products' });
            return;
        }
    }

    if (req.method === 'POST') {
        try {
            const { id, name, basePrice } = req.body || {};

            if (!id || typeof id !== 'string') {
                res.status(400).json({ error: 'Product id is required' });
                return;
            }

            const normalizedId = id.trim().toUpperCase();
            if (!normalizedId) {
                res.status(400).json({ error: 'Product id cannot be empty' });
                return;
            }

            const resolvedName = typeof name === 'string' && name.trim().length > 0
                ? name.trim()
                : normalizedId;

            const numericBasePrice = Number(basePrice);
            if (!Number.isFinite(numericBasePrice) || numericBasePrice <= 0) {
                res.status(400).json({ error: 'basePrice must be a positive number' });
                return;
            }

            const roundedBasePrice = Math.round(numericBasePrice);

            const products = await readProducts();
            const existingIndex = products.findIndex(product => product.id.toUpperCase() === normalizedId);

            const product: Product = {
                id: normalizedId,
                name: resolvedName,
                basePrice: roundedBasePrice
            };

            if (existingIndex >= 0) {
                products[existingIndex] = product;
            } else {
                products.push(product);
            }

            await writeProducts(products);

            res.status(200).json(product);
            return;
        } catch (error) {
            console.error('Failed to update products.json:', error);
            res.status(500).json({ error: 'Failed to update products' });
            return;
        }
    }

    res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
