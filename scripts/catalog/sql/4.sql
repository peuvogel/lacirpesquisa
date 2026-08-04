insert into sih_disease (id,label,filter_kind,tabnet_code,def_path) values
('pessoas_contato_serv_saude_cuidados_proc_especif','Pessoas contato serv saúde cuidados proc específ','lista_morb','321','sih/cnv/nibr.def'),
('pessoas_contato_serv_saude_por_outras_razoes','Pessoas contato serv saúde por outras razões','lista_morb','322','sih/cnv/nibr.def'),
('acidentes_de_transporte','Acidentes de transporte','lista_morb','323','sih/cnv/nibr.def'),
('quedas','Quedas','lista_morb','324','sih/cnv/nibr.def'),
('afogamento_e_submersao_acidentamente','Afogamento e submersão acidentamente','lista_morb','325','sih/cnv/nibr.def'),
('exposicao_ao_fumo_ao_fogo_e_as_chamas','Exposição ao fumo ao fogo e às chamas','lista_morb','326','sih/cnv/nibr.def'),
('envenenamento_intox_exposicao_substancias_nocivas','Envenenamento intox exposição substâncias nocivas','lista_morb','327','sih/cnv/nibr.def'),
('lesoes_autoprovocadas_voluntariamente','Lesões autoprovocadas voluntariamente','lista_morb','328','sih/cnv/nibr.def'),
('agressoes','Agressões','lista_morb','329','sih/cnv/nibr.def'),
('todas_as_outras_causas_externas','Todas as outras causas externas','lista_morb','330','sih/cnv/nibr.def'),
('amputacao_mmii','Amputação / desarticulação de membros inferiores','procedimento','3331','sih/cnv/qibr.def')
on conflict (id) do update set label=excluded.label, filter_kind=excluded.filter_kind, tabnet_code=excluded.tabnet_code, def_path=excluded.def_path;