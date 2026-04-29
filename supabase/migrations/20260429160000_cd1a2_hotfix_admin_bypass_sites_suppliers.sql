-- INICIO ARCHIVO ----------------------------------------------------
-- Migration: CD-1.A.2 hotfix — admin bypass on sites + suppliers
-- Permite que superadmin/admin (con organization_id potencialmente NULL,
-- como admin@sheina.com de Sheina) accedan a sites y suppliers sin que
-- las RLS los filtren por org match.
--
-- Las policies existentes (sites_access_internal, suppliers_access)
-- siguen vigentes para warehouse/operator/kitchen — no se tocan.
-- Como las policies son PERMISSIVE, basta con que UNA matchee.
--
-- is_admin() ya existe en BD, retorna true si el caller tiene rol
-- superadmin o admin. Definida en migrations previas.

CREATE POLICY "sites_admin_bypass"
  ON public.sites
  FOR ALL
  TO public
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "suppliers_admin_bypass"
  ON public.suppliers
  FOR ALL
  TO public
  USING (is_admin())
  WITH CHECK (is_admin());
-- FIN ARCHIVO -------------------------------------------------------
