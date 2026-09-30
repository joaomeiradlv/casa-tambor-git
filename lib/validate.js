import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(80),
  email: z.string().trim().toLowerCase().email('E-mail inválido.').max(120),
  password: z.string()
    .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
    .max(128)
    .regex(/[A-Za-z]/, 'A senha precisa ter pelo menos uma letra.')
    .regex(/[0-9]/, 'A senha precisa ter pelo menos um número.'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.').max(120),
  password: z.string().min(1, 'Informe a senha.').max(128),
});

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    qty: z.number().int().min(1).max(20),
  })).min(1, 'O carrinho está vazio.').max(30),
  shipping: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/, 'Telefone inválido.'),
    cep: z.string().trim().regex(/^\d{5}-?\d{3}$/, 'CEP inválido.'),
    street: z.string().trim().min(2).max(120),
    number: z.string().trim().min(1).max(10),
    complement: z.string().trim().max(60).optional().default(''),
    district: z.string().trim().min(2).max(60),
    city: z.string().trim().min(2).max(60),
    state: z.string().trim().toUpperCase().refine((v) => UFS.includes(v), 'UF inválida.'),
  }),
});

export const productUpdateSchema = z.object({
  price_cents: z.number().int().min(1).max(100_000_00).optional(),
  stock: z.number().int().min(0).max(100_000).optional(),
  active: z.boolean().optional(),
});

export const orderStatusSchema = z.object({
  status: z.enum(['shipped', 'cancelled']),
});

// Middleware que valida o corpo e devolve a primeira mensagem de erro
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      return res.status(400).json({ error: issue?.message || 'Dados inválidos.', field: issue?.path?.join('.') });
    }
    req.body = result.data;
    next();
  };
}
