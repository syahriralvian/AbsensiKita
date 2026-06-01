-- Hapus constraint unique atau primary key lama yang hanya menggunakan `nip` (sesuaikan nama constraint-nya)
-- Contoh jika memiliki constraint unique:
-- ALTER TABLE public.karyawan DROP CONSTRAINT IF EXISTS karyawan_nip_key;

-- Atau jika `nip` adalah Primary Key:
-- ALTER TABLE public.karyawan DROP CONSTRAINT IF EXISTS karyawan_pkey CASCADE;

-- Tambahkan constraint UNIQUE yang merupakan kombinasi `company_id` dan `nip`
ALTER TABLE public.karyawan 
ADD CONSTRAINT karyawan_company_nip_key UNIQUE (company_id, nip);

-- (Opsional) Jika Anda ingin menjadikannya sebagai Primary Key:
-- ALTER TABLE public.karyawan ADD PRIMARY KEY (company_id, nip);
