-- Pre-launch indexes for Wills App.
-- Run in Supabase Studio before deploying code that relies on
-- flow_item(flow_control_id, flow_control_item_id) uniqueness.

do $$
begin
  if exists (
    select 1
    from public.flow_item
    group by flow_control_id, flow_control_item_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate flow_item rows exist for the same flow_control_id + flow_control_item_id. Deduplicate before adding the unique index.';
  end if;
end $$;

create unique index if not exists flow_item_control_item_unique_idx
  on public.flow_item (flow_control_id, flow_control_item_id);

create index if not exists flow_item_control_item_idx
  on public.flow_item (flow_control_item_id);

create index if not exists flow_item_document_flow_item_idx
  on public.flow_item_document (flow_item_id);

create index if not exists flow_item_document_document_idx
  on public.flow_item_document (document_id);

create index if not exists calculation_item_type_idx
  on public.calculation_item (calculation_item_type_id);

create index if not exists customer_relation_relation_idx
  on public.customer_relation (relation_id);

create index if not exists mail_customer_idx
  on public.mail (customer_id);

create index if not exists document_template_parent_idx
  on public.document_template (parent_id);
