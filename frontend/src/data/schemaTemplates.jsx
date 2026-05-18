// ── Schema template data ──────────────────────────────────────────────────────
// Helpers mirror the column factory used in DesignerPage.jsx

const col = (id, name, type, opts = {}) => ({
  id, name, type,
  nullable:      opts.nullable      ?? false,
  pk:            opts.pk            ?? false,
  unique:        opts.unique        ?? false,
  autoIncrement: opts.autoIncrement ?? false,
  default:       opts.default       ?? null,
  fk:            opts.fk            ?? false,
})
const pkCol     = (id, name = 'id') => col(id, name, 'BIGINT', { pk: true, unique: true, autoIncrement: true })
const fkCol     = (id, name)        => col(id, name, 'BIGINT', { fk: true })
const fkNullCol = (id, name)        => col(id, name, 'BIGINT', { fk: true, nullable: true })

// ─────────────────────────────────────────────────────────────────────────────

export const SCHEMA_TEMPLATES = [

  // ── 1. Blog Platform ─────────────────────────────────────────────────────
  {
    id: 'blog', name: 'Blog Platform',
    description: 'Users, posts, categories, comments, and tags with a post-tag pivot table.',
    tableCount: 6, edgeCount: 6,
    color: 'bg-purple-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
    nodes: [
      { id:'bt_users',     type:'tableNode', position:{x:80,  y:80},  data:{name:'users',     columns:[pkCol('bu1'),col('bu2','name','VARCHAR'),col('bu3','email','VARCHAR',{unique:true}),col('bu4','password','VARCHAR')],methods:[{id:'m_bu_1',visibility:'+',name:'login'},{id:'m_bu_2',visibility:'+',name:'logout'},{id:'m_bu_3',visibility:'+',name:'updateProfile'}]}},
      { id:'bt_categories',type:'tableNode', position:{x:80,  y:360}, data:{name:'categories',columns:[pkCol('bc1'),col('bc2','name','VARCHAR',{unique:true}),col('bc3','slug','VARCHAR',{unique:true})]}},
      { id:'bt_posts',     type:'tableNode', position:{x:460, y:80},  data:{name:'posts',     columns:[pkCol('bp1'),fkCol('bp2','user_id'),fkNullCol('bp3','category_id'),col('bp4','title','VARCHAR'),col('bp5','body','TEXT'),col('bp6','published_at','DATETIME',{nullable:true})],methods:[{id:'m_bp_1',visibility:'+',name:'publish'},{id:'m_bp_2',visibility:'+',name:'unpublish'},{id:'m_bp_3',visibility:'+',name:'getExcerpt'}]}},
      { id:'bt_comments',  type:'tableNode', position:{x:460, y:380}, data:{name:'comments',  columns:[pkCol('bm1'),fkCol('bm2','post_id'),fkCol('bm3','user_id'),col('bm4','body','TEXT')],methods:[{id:'m_bm_1',visibility:'+',name:'approve'},{id:'m_bm_2',visibility:'+',name:'flag'}]}},
      { id:'bt_tags',      type:'tableNode', position:{x:840, y:80},  data:{name:'tags',      columns:[pkCol('bt1'),col('bt2','name','VARCHAR',{unique:true})]}},
      { id:'bt_post_tags', type:'tableNode', position:{x:840, y:360}, data:{name:'post_tags', columns:[pkCol('bpt1'),fkCol('bpt2','post_id'),fkCol('bpt3','tag_id')]}},
    ],
    edges: [
      {id:'be1',source:'bt_users',    target:'bt_posts',    type:'smoothstep',data:{type:'1:N',sourceLabel:'writes',targetLabel:''}},
      {id:'be2',source:'bt_categories',target:'bt_posts',   type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'be3',source:'bt_posts',    target:'bt_comments', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'be4',source:'bt_users',    target:'bt_comments', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'be5',source:'bt_posts',    target:'bt_post_tags',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'be6',source:'bt_tags',     target:'bt_post_tags',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 2. E-Commerce Store ───────────────────────────────────────────────────
  {
    id: 'ecommerce', name: 'E-Commerce Store',
    description: 'Products, categories, orders, order items, customers, and product reviews.',
    tableCount: 6, edgeCount: 6,
    color: 'bg-blue-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
    nodes: [
      { id:'ec_users',      type:'tableNode', position:{x:80,  y:80},  data:{name:'users',      columns:[pkCol('eu1'),col('eu2','name','VARCHAR'),col('eu3','email','VARCHAR',{unique:true}),col('eu4','password','VARCHAR')],methods:[{id:'m_eu_1',visibility:'+',name:'login'},{id:'m_eu_2',visibility:'+',name:'getOrderHistory'}]}},
      { id:'ec_categories', type:'tableNode', position:{x:80,  y:360}, data:{name:'categories', columns:[pkCol('ec1'),col('ec2','name','VARCHAR',{unique:true}),col('ec3','description','TEXT',{nullable:true})]}},
      { id:'ec_products',   type:'tableNode', position:{x:460, y:80},  data:{name:'products',   columns:[pkCol('ep1'),fkCol('ep2','category_id'),col('ep3','name','VARCHAR'),col('ep4','price','DECIMAL'),col('ep5','stock','INT',{default:'0'})],methods:[{id:'m_ep_1',visibility:'+',name:'updateStock'},{id:'m_ep_2',visibility:'+',name:'applyDiscount'}]}},
      { id:'ec_orders',     type:'tableNode', position:{x:460, y:380}, data:{name:'orders',     columns:[pkCol('eo1'),fkCol('eo2','user_id'),col('eo3','status','ENUM',{default:'pending'}),col('eo4','total_amount','DECIMAL')],methods:[{id:'m_eo_1',visibility:'+',name:'calculateTotal'},{id:'m_eo_2',visibility:'+',name:'cancel'},{id:'m_eo_3',visibility:'+',name:'getStatus'}]}},
      { id:'ec_order_items',type:'tableNode', position:{x:840, y:80},  data:{name:'order_items',columns:[pkCol('ei1'),fkCol('ei2','order_id'),fkCol('ei3','product_id'),col('ei4','quantity','INT'),col('ei5','unit_price','DECIMAL')]}},
      { id:'ec_reviews',    type:'tableNode', position:{x:840, y:380}, data:{name:'reviews',    columns:[pkCol('er1'),fkCol('er2','product_id'),fkCol('er3','user_id'),col('er4','rating','INT'),col('er5','body','TEXT',{nullable:true})]}},
    ],
    edges: [
      {id:'ee1',source:'ec_users',     target:'ec_orders',     type:'smoothstep',data:{type:'1:N',sourceLabel:'places',targetLabel:''}},
      {id:'ee2',source:'ec_categories',target:'ec_products',   type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ee3',source:'ec_orders',    target:'ec_order_items',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ee4',source:'ec_products',  target:'ec_order_items',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ee5',source:'ec_products',  target:'ec_reviews',    type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ee6',source:'ec_users',     target:'ec_reviews',    type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 3. SaaS Platform ──────────────────────────────────────────────────────
  {
    id: 'saas', name: 'SaaS Platform',
    description: 'Organizations, members, subscriptions, and invoices for a multi-tenant app.',
    tableCount: 5, edgeCount: 5,
    color: 'bg-indigo-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>,
    nodes: [
      { id:'ss_users', type:'tableNode', position:{x:80,  y:80},  data:{name:'users',         columns:[pkCol('su1'),col('su2','name','VARCHAR'),col('su3','email','VARCHAR',{unique:true}),col('su4','password','VARCHAR')],methods:[{id:'m_su_1',visibility:'+',name:'login'},{id:'m_su_2',visibility:'+',name:'updateProfile'}]}},
      { id:'ss_orgs',  type:'tableNode', position:{x:460, y:80},  data:{name:'organizations', columns:[pkCol('so1'),fkCol('so2','owner_id'),col('so3','name','VARCHAR'),col('so4','plan','ENUM',{default:'free'})],methods:[{id:'m_so_1',visibility:'+',name:'addMember'},{id:'m_so_2',visibility:'+',name:'removeMember'}]}},
      { id:'ss_mbrs',  type:'tableNode', position:{x:80,  y:380}, data:{name:'org_members',   columns:[pkCol('sm1'),fkCol('sm2','org_id'),fkCol('sm3','user_id'),col('sm4','role','ENUM',{default:'member'})]}},
      { id:'ss_subs',  type:'tableNode', position:{x:460, y:380}, data:{name:'subscriptions', columns:[pkCol('ss1'),fkCol('ss2','org_id'),col('ss3','plan','ENUM'),col('ss4','status','ENUM',{default:'active'}),col('ss5','expires_at','DATETIME',{nullable:true})],methods:[{id:'m_ss_1',visibility:'+',name:'activate'},{id:'m_ss_2',visibility:'+',name:'cancel'},{id:'m_ss_3',visibility:'+',name:'renew'}]}},
      { id:'ss_invs',  type:'tableNode', position:{x:840, y:230}, data:{name:'invoices',      columns:[pkCol('si1'),fkCol('si2','subscription_id'),col('si3','amount','DECIMAL'),col('si4','status','ENUM',{default:'unpaid'}),col('si5','issued_at','DATE')]}},
    ],
    edges: [
      {id:'se1',source:'ss_users',target:'ss_orgs', type:'smoothstep',data:{type:'1:N',sourceLabel:'owns',targetLabel:''}},
      {id:'se2',source:'ss_orgs', target:'ss_mbrs', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'se3',source:'ss_users',target:'ss_mbrs', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'se4',source:'ss_orgs', target:'ss_subs', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'se5',source:'ss_subs', target:'ss_invs', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 4. Social Network ─────────────────────────────────────────────────────
  {
    id: 'social', name: 'Social Network',
    description: 'Users, posts, likes, followers, comments, and notifications.',
    tableCount: 6, edgeCount: 6,
    color: 'bg-pink-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    nodes: [
      { id:'sn_users',         type:'tableNode', position:{x:80,  y:80},  data:{name:'users',         columns:[pkCol('snu1'),col('snu2','name','VARCHAR'),col('snu3','email','VARCHAR',{unique:true}),col('snu4','password','VARCHAR'),col('snu5','bio','TEXT',{nullable:true}),col('snu6','avatar_url','VARCHAR',{nullable:true})],methods:[{id:'m_snu_1',visibility:'+',name:'login'},{id:'m_snu_2',visibility:'+',name:'follow'},{id:'m_snu_3',visibility:'+',name:'unfollow'}]}},
      { id:'sn_posts',         type:'tableNode', position:{x:460, y:80},  data:{name:'posts',         columns:[pkCol('snp1'),fkCol('snp2','user_id'),col('snp3','body','TEXT'),col('snp4','image_url','VARCHAR',{nullable:true}),col('snp5','created_at','DATETIME')],methods:[{id:'m_snp_1',visibility:'+',name:'publish'},{id:'m_snp_2',visibility:'+',name:'delete'},{id:'m_snp_3',visibility:'+',name:'like'}]}},
      { id:'sn_comments',      type:'tableNode', position:{x:840, y:80},  data:{name:'comments',      columns:[pkCol('snc1'),fkCol('snc2','post_id'),fkCol('snc3','user_id'),col('snc4','body','TEXT'),col('snc5','created_at','DATETIME')]}},
      { id:'sn_likes',         type:'tableNode', position:{x:80,  y:360}, data:{name:'likes',         columns:[pkCol('snl1'),fkCol('snl2','post_id'),fkCol('snl3','user_id')]}},
      { id:'sn_followers',     type:'tableNode', position:{x:460, y:360}, data:{name:'followers',     columns:[pkCol('snf1'),fkCol('snf2','follower_id'),fkCol('snf3','following_id')]}},
      { id:'sn_notifications', type:'tableNode', position:{x:840, y:360}, data:{name:'notifications', columns:[pkCol('snn1'),fkCol('snn2','user_id'),fkCol('snn3','actor_id'),col('snn4','type','VARCHAR'),col('snn5','message','TEXT'),col('snn6','read_at','DATETIME',{nullable:true})],methods:[{id:'m_snn_1',visibility:'+',name:'markAsRead'},{id:'m_snn_2',visibility:'+',name:'dismiss'}]}},
    ],
    edges: [
      {id:'sne1',source:'sn_users',  target:'sn_posts',         type:'smoothstep',data:{type:'1:N',sourceLabel:'writes',targetLabel:''}},
      {id:'sne2',source:'sn_posts',  target:'sn_comments',      type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'sne3',source:'sn_users',  target:'sn_comments',      type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'sne4',source:'sn_posts',  target:'sn_likes',         type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'sne5',source:'sn_users',  target:'sn_followers',     type:'smoothstep',data:{type:'1:N',sourceLabel:'follows',targetLabel:''}},
      {id:'sne6',source:'sn_users',  target:'sn_notifications', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 5. Job Board ──────────────────────────────────────────────────────────
  {
    id: 'jobboard', name: 'Job Board',
    description: 'Companies, jobs, applications, candidates, categories, and saved jobs.',
    tableCount: 6, edgeCount: 6,
    color: 'bg-cyan-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h8m5-10V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2"/></svg>,
    nodes: [
      { id:'jb_companies',   type:'tableNode', position:{x:80,  y:80},  data:{name:'companies',   columns:[pkCol('jbc1'),col('jbc2','name','VARCHAR'),col('jbc3','website','VARCHAR',{nullable:true}),col('jbc4','description','TEXT',{nullable:true})],methods:[{id:'m_jbc_1',visibility:'+',name:'postJob'},{id:'m_jbc_2',visibility:'+',name:'updateProfile'}]}},
      { id:'jb_categories',  type:'tableNode', position:{x:80,  y:360}, data:{name:'categories',  columns:[pkCol('jbcat1'),col('jbcat2','name','VARCHAR',{unique:true}),col('jbcat3','slug','VARCHAR',{unique:true})]}},
      { id:'jb_jobs',        type:'tableNode', position:{x:460, y:80},  data:{name:'jobs',        columns:[pkCol('jbj1'),fkCol('jbj2','company_id'),fkCol('jbj3','category_id'),col('jbj4','title','VARCHAR'),col('jbj5','type','ENUM',{default:'full_time'}),col('jbj6','salary_min','DECIMAL',{nullable:true}),col('jbj7','salary_max','DECIMAL',{nullable:true}),col('jbj8','closes_at','DATE',{nullable:true})],methods:[{id:'m_jbj_1',visibility:'+',name:'publish'},{id:'m_jbj_2',visibility:'+',name:'close'},{id:'m_jbj_3',visibility:'+',name:'getApplicants'}]}},
      { id:'jb_candidates',  type:'tableNode', position:{x:460, y:360}, data:{name:'candidates',  columns:[pkCol('jbcn1'),col('jbcn2','name','VARCHAR'),col('jbcn3','email','VARCHAR',{unique:true}),col('jbcn4','password','VARCHAR'),col('jbcn5','resume_url','VARCHAR',{nullable:true})]}},
      { id:'jb_applications',type:'tableNode', position:{x:840, y:80},  data:{name:'applications',columns:[pkCol('jba1'),fkCol('jba2','job_id'),fkCol('jba3','candidate_id'),col('jba4','status','ENUM',{default:'applied'}),col('jba5','cover_letter','TEXT',{nullable:true}),col('jba6','applied_at','DATETIME')],methods:[{id:'m_jba_1',visibility:'+',name:'submit'},{id:'m_jba_2',visibility:'+',name:'withdraw'},{id:'m_jba_3',visibility:'+',name:'getStatus'}]}},
      { id:'jb_saved_jobs',  type:'tableNode', position:{x:840, y:360}, data:{name:'saved_jobs',  columns:[pkCol('jbs1'),fkCol('jbs2','candidate_id'),fkCol('jbs3','job_id')]}},
    ],
    edges: [
      {id:'jbe1',source:'jb_companies',  target:'jb_jobs',        type:'smoothstep',data:{type:'1:N',sourceLabel:'posts',targetLabel:''}},
      {id:'jbe2',source:'jb_categories', target:'jb_jobs',        type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'jbe3',source:'jb_jobs',       target:'jb_applications',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'jbe4',source:'jb_candidates', target:'jb_applications',type:'smoothstep',data:{type:'1:N',sourceLabel:'applies',targetLabel:''}},
      {id:'jbe5',source:'jb_candidates', target:'jb_saved_jobs',  type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'jbe6',source:'jb_jobs',       target:'jb_saved_jobs',  type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 6. Booking & Reservation ──────────────────────────────────────────────
  {
    id: 'booking', name: 'Booking & Reservation',
    description: 'Users, services, providers, bookings, payments, and reviews. Works for hotels, clinics, salons.',
    tableCount: 6, edgeCount: 7,
    color: 'bg-teal-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
    nodes: [
      { id:'bk_users',    type:'tableNode', position:{x:80,  y:80},  data:{name:'users',    columns:[pkCol('bku1'),col('bku2','name','VARCHAR'),col('bku3','email','VARCHAR',{unique:true}),col('bku4','password','VARCHAR'),col('bku5','phone','VARCHAR',{nullable:true})]}},
      { id:'bk_providers',type:'tableNode', position:{x:80,  y:360}, data:{name:'providers',columns:[pkCol('bkpr1'),col('bkpr2','name','VARCHAR'),col('bkpr3','email','VARCHAR',{unique:true}),col('bkpr4','phone','VARCHAR'),col('bkpr5','bio','TEXT',{nullable:true})],methods:[{id:'m_bkpr_1',visibility:'+',name:'getAvailability'},{id:'m_bkpr_2',visibility:'+',name:'updateSchedule'}]}},
      { id:'bk_services', type:'tableNode', position:{x:460, y:80},  data:{name:'services', columns:[pkCol('bks1'),fkCol('bks2','provider_id'),col('bks3','name','VARCHAR'),col('bks4','description','TEXT',{nullable:true}),col('bks5','duration_min','INT'),col('bks6','price','DECIMAL')]}},
      { id:'bk_bookings', type:'tableNode', position:{x:460, y:360}, data:{name:'bookings', columns:[pkCol('bkb1'),fkCol('bkb2','user_id'),fkCol('bkb3','service_id'),fkCol('bkb4','provider_id'),col('bkb5','scheduled_at','DATETIME'),col('bkb6','status','ENUM',{default:'pending'})],methods:[{id:'m_bkb_1',visibility:'+',name:'confirm'},{id:'m_bkb_2',visibility:'+',name:'cancel'},{id:'m_bkb_3',visibility:'+',name:'calculatePrice'}]}},
      { id:'bk_payments', type:'tableNode', position:{x:840, y:80},  data:{name:'payments', columns:[pkCol('bkp1'),fkCol('bkp2','booking_id'),col('bkp3','amount','DECIMAL'),col('bkp4','method','ENUM'),col('bkp5','status','ENUM',{default:'pending'}),col('bkp6','paid_at','DATETIME',{nullable:true})]}},
      { id:'bk_reviews',  type:'tableNode', position:{x:840, y:360}, data:{name:'reviews',  columns:[pkCol('bkr1'),fkCol('bkr2','booking_id'),fkCol('bkr3','user_id'),col('bkr4','rating','INT'),col('bkr5','comment','TEXT',{nullable:true})],methods:[{id:'m_bkr_1',visibility:'+',name:'approve'},{id:'m_bkr_2',visibility:'+',name:'flag'}]}},
    ],
    edges: [
      {id:'bke1',source:'bk_providers',target:'bk_services', type:'smoothstep',data:{type:'1:N',sourceLabel:'offers',targetLabel:''}},
      {id:'bke2',source:'bk_users',    target:'bk_bookings', type:'smoothstep',data:{type:'1:N',sourceLabel:'makes',targetLabel:''}},
      {id:'bke3',source:'bk_services', target:'bk_bookings', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'bke4',source:'bk_providers',target:'bk_bookings', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'bke5',source:'bk_bookings', target:'bk_payments', type:'smoothstep',data:{type:'1:1',sourceLabel:'',targetLabel:''}},
      {id:'bke6',source:'bk_bookings', target:'bk_reviews',  type:'smoothstep',data:{type:'1:1',sourceLabel:'',targetLabel:''}},
      {id:'bke7',source:'bk_users',    target:'bk_reviews',  type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 7. Hospital & Clinic ──────────────────────────────────────────────────
  {
    id: 'hospital', name: 'Hospital & Clinic',
    description: 'Patients, doctors, appointments, prescriptions, departments, and medical records.',
    tableCount: 6, edgeCount: 6,
    color: 'bg-red-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>,
    nodes: [
      { id:'hc_departments',    type:'tableNode', position:{x:80,  y:80},  data:{name:'departments',    columns:[pkCol('hcd1'),col('hcd2','name','VARCHAR'),col('hcd3','description','TEXT',{nullable:true})]}},
      { id:'hc_doctors',        type:'tableNode', position:{x:460, y:80},  data:{name:'doctors',        columns:[pkCol('hcdr1'),fkCol('hcdr2','department_id'),col('hcdr3','name','VARCHAR'),col('hcdr4','email','VARCHAR',{unique:true}),col('hcdr5','phone','VARCHAR'),col('hcdr6','specialization','VARCHAR')],methods:[{id:'m_hcdr_1',visibility:'+',name:'getSchedule'},{id:'m_hcdr_2',visibility:'+',name:'prescribe'}]}},
      { id:'hc_patients',       type:'tableNode', position:{x:840, y:80},  data:{name:'patients',       columns:[pkCol('hcp1'),col('hcp2','name','VARCHAR'),col('hcp3','email','VARCHAR',{unique:true}),col('hcp4','phone','VARCHAR'),col('hcp5','date_of_birth','DATE'),col('hcp6','blood_type','VARCHAR',{nullable:true})],methods:[{id:'m_hcp_1',visibility:'+',name:'register'},{id:'m_hcp_2',visibility:'+',name:'getHistory'},{id:'m_hcp_3',visibility:'+',name:'scheduleAppointment'}]}},
      { id:'hc_appointments',   type:'tableNode', position:{x:460, y:360}, data:{name:'appointments',   columns:[pkCol('hca1'),fkCol('hca2','patient_id'),fkCol('hca3','doctor_id'),col('hca4','scheduled_at','DATETIME'),col('hca5','status','ENUM',{default:'scheduled'}),col('hca6','notes','TEXT',{nullable:true})],methods:[{id:'m_hca_1',visibility:'+',name:'confirm'},{id:'m_hca_2',visibility:'+',name:'cancel'},{id:'m_hca_3',visibility:'+',name:'complete'}]}},
      { id:'hc_prescriptions',  type:'tableNode', position:{x:80,  y:360}, data:{name:'prescriptions',  columns:[pkCol('hcrx1'),fkCol('hcrx2','appointment_id'),col('hcrx3','medication','VARCHAR'),col('hcrx4','dosage','VARCHAR'),col('hcrx5','duration_days','INT')]}},
      { id:'hc_medical_records',type:'tableNode', position:{x:840, y:360}, data:{name:'medical_records',columns:[pkCol('hcmr1'),fkCol('hcmr2','patient_id'),fkCol('hcmr3','doctor_id'),col('hcmr4','diagnosis','TEXT'),col('hcmr5','recorded_at','DATE')]}},
    ],
    edges: [
      {id:'hce1',source:'hc_departments',  target:'hc_doctors',        type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'hce2',source:'hc_patients',     target:'hc_appointments',   type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'hce3',source:'hc_doctors',      target:'hc_appointments',   type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'hce4',source:'hc_appointments', target:'hc_prescriptions',  type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'hce5',source:'hc_patients',     target:'hc_medical_records',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'hce6',source:'hc_doctors',      target:'hc_medical_records',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 8. School & University ────────────────────────────────────────────────
  {
    id: 'school', name: 'School & University',
    description: 'Students, teachers, courses, enrollments, grades, departments, and classrooms.',
    tableCount: 7, edgeCount: 7,
    color: 'bg-green-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3L2 9l10 6 10-6-10-6zM2 17l10 6 10-6M2 12l10 6 10-6"/></svg>,
    nodes: [
      { id:'su_departments', type:'tableNode', position:{x:80,  y:80},  data:{name:'departments', columns:[pkCol('sud1'),col('sud2','name','VARCHAR'),col('sud3','code','VARCHAR',{unique:true})]}},
      { id:'su_classrooms',  type:'tableNode', position:{x:840, y:80},  data:{name:'classrooms',  columns:[pkCol('sucl1'),col('sucl2','name','VARCHAR'),col('sucl3','capacity','INT')]}},
      { id:'su_teachers',    type:'tableNode', position:{x:460, y:80},  data:{name:'teachers',    columns:[pkCol('sut1'),fkCol('sut2','department_id'),col('sut3','name','VARCHAR'),col('sut4','email','VARCHAR',{unique:true}),col('sut5','phone','VARCHAR',{nullable:true})],methods:[{id:'m_sut_1',visibility:'+',name:'gradeStudent'},{id:'m_sut_2',visibility:'+',name:'getSchedule'}]}},
      { id:'su_courses',     type:'tableNode', position:{x:460, y:360}, data:{name:'courses',     columns:[pkCol('suc1'),fkCol('suc2','department_id'),fkCol('suc3','teacher_id'),fkNullCol('suc4','classroom_id'),col('suc5','name','VARCHAR'),col('suc6','code','VARCHAR',{unique:true}),col('suc7','credits','INT')],methods:[{id:'m_suc_1',visibility:'+',name:'open'},{id:'m_suc_2',visibility:'+',name:'close'},{id:'m_suc_3',visibility:'+',name:'getEnrolled'}]}},
      { id:'su_students',    type:'tableNode', position:{x:80,  y:360}, data:{name:'students',    columns:[pkCol('sust1'),fkCol('sust2','department_id'),col('sust3','name','VARCHAR'),col('sust4','email','VARCHAR',{unique:true}),col('sust5','enrolled_on','DATE')],methods:[{id:'m_sust_1',visibility:'+',name:'enroll'},{id:'m_sust_2',visibility:'+',name:'getGrades'},{id:'m_sust_3',visibility:'+',name:'withdraw'}]}},
      { id:'su_enrollments', type:'tableNode', position:{x:80,  y:640}, data:{name:'enrollments', columns:[pkCol('sue1'),fkCol('sue2','student_id'),fkCol('sue3','course_id'),col('sue4','semester','VARCHAR'),col('sue5','year','INT')]}},
      { id:'su_grades',      type:'tableNode', position:{x:460, y:640}, data:{name:'grades',      columns:[pkCol('sug1'),fkCol('sug2','enrollment_id'),col('sug3','grade','DECIMAL'),col('sug4','graded_at','DATE',{nullable:true})]}},
    ],
    edges: [
      {id:'sue1',source:'su_departments',target:'su_teachers',    type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'sue2',source:'su_departments',target:'su_courses',     type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'sue3',source:'su_teachers',   target:'su_courses',     type:'smoothstep',data:{type:'1:N',sourceLabel:'teaches',targetLabel:''}},
      {id:'sue4',source:'su_departments',target:'su_students',    type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'sue5',source:'su_students',   target:'su_enrollments', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'sue6',source:'su_courses',    target:'su_enrollments', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'sue7',source:'su_enrollments',target:'su_grades',      type:'smoothstep',data:{type:'1:1',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 9. Library Management ─────────────────────────────────────────────────
  {
    id: 'library', name: 'Library Management',
    description: 'Books, authors, members, loans, reservations, categories, and a book-authors pivot.',
    tableCount: 7, edgeCount: 7,
    color: 'bg-amber-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>,
    nodes: [
      { id:'lb_categories',   type:'tableNode', position:{x:80,  y:80},  data:{name:'categories',   columns:[pkCol('lbcat1'),col('lbcat2','name','VARCHAR',{unique:true})]}},
      { id:'lb_authors',      type:'tableNode', position:{x:840, y:80},  data:{name:'authors',      columns:[pkCol('lba1'),col('lba2','name','VARCHAR'),col('lba3','bio','TEXT',{nullable:true})]}},
      { id:'lb_books',        type:'tableNode', position:{x:460, y:80},  data:{name:'books',        columns:[pkCol('lbb1'),fkCol('lbb2','category_id'),col('lbb3','title','VARCHAR'),col('lbb4','isbn','VARCHAR',{unique:true}),col('lbb5','pub_year','INT'),col('lbb6','total_copies','INT'),col('lbb7','avail_copies','INT')],methods:[{id:'m_lbb_1',visibility:'+',name:'checkOut'},{id:'m_lbb_2',visibility:'+',name:'checkIn'},{id:'m_lbb_3',visibility:'+',name:'reserve'}]}},
      { id:'lb_book_authors', type:'tableNode', position:{x:840, y:360}, data:{name:'book_authors', columns:[pkCol('lbba1'),fkCol('lbba2','book_id'),fkCol('lbba3','author_id')]}},
      { id:'lb_members',      type:'tableNode', position:{x:80,  y:360}, data:{name:'members',      columns:[pkCol('lbm1'),col('lbm2','name','VARCHAR'),col('lbm3','email','VARCHAR',{unique:true}),col('lbm4','phone','VARCHAR'),col('lbm5','expires_at','DATE')],methods:[{id:'m_lbm_1',visibility:'+',name:'register'},{id:'m_lbm_2',visibility:'+',name:'getLoans'},{id:'m_lbm_3',visibility:'+',name:'renewLoan'}]}},
      { id:'lb_loans',        type:'tableNode', position:{x:80,  y:640}, data:{name:'loans',        columns:[pkCol('lbl1'),fkCol('lbl2','book_id'),fkCol('lbl3','member_id'),col('lbl4','loaned_at','DATE'),col('lbl5','due_at','DATE'),col('lbl6','returned_at','DATE',{nullable:true})],methods:[{id:'m_lbl_1',visibility:'+',name:'extend'},{id:'m_lbl_2',visibility:'+',name:'return'},{id:'m_lbl_3',visibility:'+',name:'calculateFine'}]}},
      { id:'lb_reservations', type:'tableNode', position:{x:460, y:360}, data:{name:'reservations', columns:[pkCol('lbr1'),fkCol('lbr2','book_id'),fkCol('lbr3','member_id'),col('lbr4','reserved_at','DATETIME'),col('lbr5','status','ENUM',{default:'active'})]}},
    ],
    edges: [
      {id:'lbe1',source:'lb_categories',  target:'lb_books',        type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'lbe2',source:'lb_books',       target:'lb_book_authors', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'lbe3',source:'lb_authors',     target:'lb_book_authors', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'lbe4',source:'lb_books',       target:'lb_loans',        type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'lbe5',source:'lb_members',     target:'lb_loans',        type:'smoothstep',data:{type:'1:N',sourceLabel:'borrows',targetLabel:''}},
      {id:'lbe6',source:'lb_books',       target:'lb_reservations', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'lbe7',source:'lb_members',     target:'lb_reservations', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 10. Real Estate ───────────────────────────────────────────────────────
  {
    id: 'realestate', name: 'Real Estate',
    description: 'Properties, agents, agencies, listings, offers, images, and property types.',
    tableCount: 7, edgeCount: 6,
    color: 'bg-orange-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 21V12h6v9"/></svg>,
    nodes: [
      { id:'re_agencies',        type:'tableNode', position:{x:80,  y:80},  data:{name:'agencies',        columns:[pkCol('rea1'),col('rea2','name','VARCHAR'),col('rea3','license_no','VARCHAR'),col('rea4','phone','VARCHAR'),col('rea5','email','VARCHAR',{unique:true})]}},
      { id:'re_property_types',  type:'tableNode', position:{x:840, y:80},  data:{name:'property_types',  columns:[pkCol('rept1'),col('rept2','name','VARCHAR',{unique:true})]}},
      { id:'re_agents',          type:'tableNode', position:{x:460, y:80},  data:{name:'agents',          columns:[pkCol('reag1'),fkCol('reag2','agency_id'),col('reag3','name','VARCHAR'),col('reag4','email','VARCHAR',{unique:true}),col('reag5','phone','VARCHAR'),col('reag6','license_no','VARCHAR')],methods:[{id:'m_reag_1',visibility:'+',name:'listProperty'},{id:'m_reag_2',visibility:'+',name:'getListings'}]}},
      { id:'re_properties',      type:'tableNode', position:{x:460, y:360}, data:{name:'properties',      columns:[pkCol('rep1'),fkCol('rep2','agent_id'),fkCol('rep3','type_id'),col('rep4','address','VARCHAR'),col('rep5','city','VARCHAR'),col('rep6','area_sqft','DECIMAL'),col('rep7','bedrooms','INT',{nullable:true}),col('rep8','bathrooms','INT',{nullable:true})],methods:[{id:'m_rep_1',visibility:'+',name:'list'},{id:'m_rep_2',visibility:'+',name:'delist'},{id:'m_rep_3',visibility:'+',name:'getDetails'}]}},
      { id:'re_listings',        type:'tableNode', position:{x:80,  y:360}, data:{name:'listings',        columns:[pkCol('rel1'),fkCol('rel2','property_id'),col('rel3','price','DECIMAL'),col('rel4','status','ENUM',{default:'active'}),col('rel5','listed_at','DATE'),col('rel6','description','TEXT',{nullable:true})]}},
      { id:'re_offers',          type:'tableNode', position:{x:80,  y:640}, data:{name:'offers',          columns:[pkCol('reo1'),fkCol('reo2','listing_id'),col('reo3','buyer_name','VARCHAR'),col('reo4','offer_price','DECIMAL'),col('reo5','status','ENUM',{default:'pending'}),col('reo6','offered_at','DATE')],methods:[{id:'m_reo_1',visibility:'+',name:'submit'},{id:'m_reo_2',visibility:'+',name:'accept'},{id:'m_reo_3',visibility:'+',name:'reject'}]}},
      { id:'re_property_images', type:'tableNode', position:{x:840, y:360}, data:{name:'property_images', columns:[pkCol('repi1'),fkCol('repi2','property_id'),col('repi3','url','VARCHAR'),col('repi4','is_primary','BOOLEAN',{default:'0'})]}},
    ],
    edges: [
      {id:'ree1',source:'re_agencies',       target:'re_agents',         type:'smoothstep',data:{type:'1:N',sourceLabel:'employs',targetLabel:''}},
      {id:'ree2',source:'re_agents',         target:'re_properties',     type:'smoothstep',data:{type:'1:N',sourceLabel:'manages',targetLabel:''}},
      {id:'ree3',source:'re_property_types', target:'re_properties',     type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ree4',source:'re_properties',     target:'re_listings',       type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ree5',source:'re_listings',       target:'re_offers',         type:'smoothstep',data:{type:'1:N',sourceLabel:'receives',targetLabel:''}},
      {id:'ree6',source:'re_properties',     target:'re_property_images',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 11. Restaurant & Food Delivery ────────────────────────────────────────
  {
    id: 'fooddelivery', name: 'Food Delivery',
    description: 'Restaurants, menus, menu items, orders, order items, drivers, customers, and deliveries.',
    tableCount: 8, edgeCount: 8,
    color: 'bg-rose-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>,
    nodes: [
      { id:'fd_restaurants', type:'tableNode', position:{x:80,  y:80},  data:{name:'restaurants', columns:[pkCol('fdr1'),col('fdr2','name','VARCHAR'),col('fdr3','address','VARCHAR'),col('fdr4','phone','VARCHAR'),col('fdr5','rating','DECIMAL',{nullable:true})],methods:[{id:'m_fdr_1',visibility:'+',name:'openMenu'},{id:'m_fdr_2',visibility:'+',name:'updateMenu'}]}},
      { id:'fd_menus',       type:'tableNode', position:{x:460, y:80},  data:{name:'menus',       columns:[pkCol('fdm1'),fkCol('fdm2','restaurant_id'),col('fdm3','name','VARCHAR'),col('fdm4','is_active','BOOLEAN',{default:'1'})]}},
      { id:'fd_menu_items',  type:'tableNode', position:{x:840, y:80},  data:{name:'menu_items',  columns:[pkCol('fdmi1'),fkCol('fdmi2','menu_id'),col('fdmi3','name','VARCHAR'),col('fdmi4','description','TEXT',{nullable:true}),col('fdmi5','price','DECIMAL'),col('fdmi6','is_available','BOOLEAN',{default:'1'})]}},
      { id:'fd_customers',   type:'tableNode', position:{x:80,  y:360}, data:{name:'customers',   columns:[pkCol('fdcu1'),col('fdcu2','name','VARCHAR'),col('fdcu3','email','VARCHAR',{unique:true}),col('fdcu4','password','VARCHAR'),col('fdcu5','phone','VARCHAR'),col('fdcu6','address','TEXT',{nullable:true})]}},
      { id:'fd_orders',      type:'tableNode', position:{x:460, y:360}, data:{name:'orders',      columns:[pkCol('fdo1'),fkCol('fdo2','customer_id'),fkCol('fdo3','restaurant_id'),col('fdo4','status','ENUM',{default:'pending'}),col('fdo5','total_amount','DECIMAL'),col('fdo6','placed_at','DATETIME')],methods:[{id:'m_fdo_1',visibility:'+',name:'place'},{id:'m_fdo_2',visibility:'+',name:'cancel'},{id:'m_fdo_3',visibility:'+',name:'track'},{id:'m_fdo_4',visibility:'+',name:'calculateTotal'}]}},
      { id:'fd_order_items', type:'tableNode', position:{x:840, y:360}, data:{name:'order_items', columns:[pkCol('fdoi1'),fkCol('fdoi2','order_id'),fkCol('fdoi3','menu_item_id'),col('fdoi4','quantity','INT'),col('fdoi5','unit_price','DECIMAL')]}},
      { id:'fd_drivers',     type:'tableNode', position:{x:80,  y:640}, data:{name:'drivers',     columns:[pkCol('fddv1'),col('fddv2','name','VARCHAR'),col('fddv3','phone','VARCHAR',{unique:true}),col('fddv4','vehicle_plate','VARCHAR'),col('fddv5','is_available','BOOLEAN',{default:'1'})],methods:[{id:'m_fddv_1',visibility:'+',name:'acceptDelivery'},{id:'m_fddv_2',visibility:'+',name:'completeDelivery'}]}},
      { id:'fd_deliveries',  type:'tableNode', position:{x:460, y:640}, data:{name:'deliveries',  columns:[pkCol('fddl1'),fkCol('fddl2','order_id'),fkCol('fddl3','driver_id'),col('fddl4','status','ENUM',{default:'pending'}),col('fddl5','delivered_at','DATETIME',{nullable:true})]}},
    ],
    edges: [
      {id:'fde1',source:'fd_restaurants',target:'fd_menus',       type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'fde2',source:'fd_menus',       target:'fd_menu_items', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'fde3',source:'fd_customers',   target:'fd_orders',     type:'smoothstep',data:{type:'1:N',sourceLabel:'places',targetLabel:''}},
      {id:'fde4',source:'fd_restaurants', target:'fd_orders',     type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'fde5',source:'fd_orders',      target:'fd_order_items',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'fde6',source:'fd_menu_items',  target:'fd_order_items',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'fde7',source:'fd_orders',      target:'fd_deliveries', type:'smoothstep',data:{type:'1:1',sourceLabel:'',targetLabel:''}},
      {id:'fde8',source:'fd_drivers',     target:'fd_deliveries', type:'smoothstep',data:{type:'1:N',sourceLabel:'handles',targetLabel:''}},
    ],
  },

  // ── 12. Authentication & Roles ────────────────────────────────────────────
  {
    id: 'authroles', name: 'Auth & Roles',
    description: 'Users, roles, permissions, pivot tables, sessions, and password resets.',
    tableCount: 7, edgeCount: 6,
    color: 'bg-slate-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
    nodes: [
      { id:'ar_users',           type:'tableNode', position:{x:80,  y:80},  data:{name:'users',           columns:[pkCol('aru1'),col('aru2','name','VARCHAR'),col('aru3','email','VARCHAR',{unique:true}),col('aru4','password','VARCHAR'),col('aru5','is_active','BOOLEAN',{default:'1'}),col('aru6','email_verified_at','DATETIME',{nullable:true})],methods:[{id:'m_aru_1',visibility:'+',name:'login'},{id:'m_aru_2',visibility:'+',name:'logout'},{id:'m_aru_3',visibility:'+',name:'changePassword'}]}},
      { id:'ar_roles',           type:'tableNode', position:{x:460, y:80},  data:{name:'roles',           columns:[pkCol('arr1'),col('arr2','name','VARCHAR',{unique:true}),col('arr3','description','TEXT',{nullable:true})],methods:[{id:'m_arr_1',visibility:'+',name:'assignPermission'},{id:'m_arr_2',visibility:'+',name:'revokePermission'}]}},
      { id:'ar_permissions',     type:'tableNode', position:{x:840, y:80},  data:{name:'permissions',     columns:[pkCol('arp1'),col('arp2','name','VARCHAR',{unique:true}),col('arp3','description','TEXT',{nullable:true})],methods:[{id:'m_arp_1',visibility:'+',name:'check'},{id:'m_arp_2',visibility:'+',name:'grant'}]}},
      { id:'ar_role_user',       type:'tableNode', position:{x:460, y:360}, data:{name:'role_user',       columns:[pkCol('arru1'),fkCol('arru2','user_id'),fkCol('arru3','role_id')]}},
      { id:'ar_permission_role', type:'tableNode', position:{x:840, y:360}, data:{name:'permission_role', columns:[pkCol('arpr1'),fkCol('arpr2','role_id'),fkCol('arpr3','permission_id')]}},
      { id:'ar_sessions',        type:'tableNode', position:{x:80,  y:360}, data:{name:'sessions',        columns:[pkCol('arss1'),fkCol('arss2','user_id'),col('arss3','token','VARCHAR',{unique:true}),col('arss4','expires_at','DATETIME'),col('arss5','ip_address','VARCHAR',{nullable:true})]}},
      { id:'ar_password_resets', type:'tableNode', position:{x:80,  y:640}, data:{name:'password_resets', columns:[pkCol('arpr1x'),fkCol('arpr2x','user_id'),col('arpr3x','token','VARCHAR',{unique:true}),col('arpr4x','expires_at','DATETIME'),col('arpr5x','used_at','DATETIME',{nullable:true})]}},
    ],
    edges: [
      {id:'are1',source:'ar_users',       target:'ar_role_user',       type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'are2',source:'ar_roles',       target:'ar_role_user',       type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'are3',source:'ar_roles',       target:'ar_permission_role', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'are4',source:'ar_permissions', target:'ar_permission_role', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'are5',source:'ar_users',       target:'ar_sessions',        type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'are6',source:'ar_users',       target:'ar_password_resets', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 13. CMS ───────────────────────────────────────────────────────────────
  {
    id: 'cms', name: 'CMS',
    description: 'Users, posts, pages, media, categories, tags, comments, and content revisions.',
    tableCount: 9, edgeCount: 9,
    color: 'bg-violet-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>,
    nodes: [
      { id:'cm_users',     type:'tableNode', position:{x:80,  y:80},  data:{name:'users',     columns:[pkCol('cmu1'),col('cmu2','name','VARCHAR'),col('cmu3','email','VARCHAR',{unique:true}),col('cmu4','password','VARCHAR'),col('cmu5','role','ENUM',{default:'author'})],methods:[{id:'m_cmu_1',visibility:'+',name:'login'},{id:'m_cmu_2',visibility:'+',name:'logout'},{id:'m_cmu_3',visibility:'+',name:'updateProfile'}]}},
      { id:'cm_categories',type:'tableNode', position:{x:460, y:80},  data:{name:'categories',columns:[pkCol('cmcat1'),fkNullCol('cmcat2','parent_id'),col('cmcat3','name','VARCHAR'),col('cmcat4','slug','VARCHAR',{unique:true})]}},
      { id:'cm_tags',      type:'tableNode', position:{x:840, y:80},  data:{name:'tags',      columns:[pkCol('cmt1'),col('cmt2','name','VARCHAR',{unique:true}),col('cmt3','slug','VARCHAR',{unique:true})]}},
      { id:'cm_media',     type:'tableNode', position:{x:80,  y:360}, data:{name:'media',     columns:[pkCol('cmmed1'),fkCol('cmmed2','user_id'),col('cmmed3','filename','VARCHAR'),col('cmmed4','path','VARCHAR'),col('cmmed5','mime_type','VARCHAR'),col('cmmed6','size_bytes','INT')],methods:[{id:'m_cmmed_1',visibility:'+',name:'upload'},{id:'m_cmmed_2',visibility:'+',name:'delete'},{id:'m_cmmed_3',visibility:'+',name:'resize'}]}},
      { id:'cm_pages',     type:'tableNode', position:{x:460, y:360}, data:{name:'pages',     columns:[pkCol('cmpg1'),fkCol('cmpg2','user_id'),col('cmpg3','title','VARCHAR'),col('cmpg4','slug','VARCHAR',{unique:true}),col('cmpg5','content','LONGTEXT'),col('cmpg6','status','ENUM',{default:'draft'})],methods:[{id:'m_cmpg_1',visibility:'+',name:'publish'},{id:'m_cmpg_2',visibility:'+',name:'unpublish'},{id:'m_cmpg_3',visibility:'+',name:'createRevision'}]}},
      { id:'cm_posts',     type:'tableNode', position:{x:840, y:360}, data:{name:'posts',     columns:[pkCol('cmpo1'),fkCol('cmpo2','user_id'),fkNullCol('cmpo3','category_id'),col('cmpo4','title','VARCHAR'),col('cmpo5','slug','VARCHAR',{unique:true}),col('cmpo6','body','LONGTEXT'),col('cmpo7','status','ENUM',{default:'draft'}),col('cmpo8','published_at','DATETIME',{nullable:true})]}},
      { id:'cm_post_tag',  type:'tableNode', position:{x:840, y:640}, data:{name:'post_tag',  columns:[pkCol('cmpt1'),fkCol('cmpt2','post_id'),fkCol('cmpt3','tag_id')]}},
      { id:'cm_comments',  type:'tableNode', position:{x:460, y:640}, data:{name:'comments',  columns:[pkCol('cmcm1'),fkCol('cmcm2','post_id'),fkNullCol('cmcm3','user_id'),col('cmcm4','author_name','VARCHAR',{nullable:true}),col('cmcm5','body','TEXT'),col('cmcm6','approved','BOOLEAN',{default:'0'})]}},
      { id:'cm_revisions', type:'tableNode', position:{x:80,  y:640}, data:{name:'revisions', columns:[pkCol('cmrv1'),fkCol('cmrv2','post_id'),fkCol('cmrv3','user_id'),col('cmrv4','content','LONGTEXT'),col('cmrv5','created_at','DATETIME')]}},
    ],
    edges: [
      {id:'cme1',source:'cm_users',      target:'cm_posts',    type:'smoothstep',data:{type:'1:N',sourceLabel:'authors',targetLabel:''}},
      {id:'cme2',source:'cm_users',      target:'cm_pages',    type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'cme3',source:'cm_users',      target:'cm_media',    type:'smoothstep',data:{type:'1:N',sourceLabel:'uploads',targetLabel:''}},
      {id:'cme4',source:'cm_categories', target:'cm_posts',    type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'cme5',source:'cm_posts',      target:'cm_post_tag', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'cme6',source:'cm_tags',       target:'cm_post_tag', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'cme7',source:'cm_posts',      target:'cm_comments', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'cme8',source:'cm_posts',      target:'cm_revisions',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'cme9',source:'cm_users',      target:'cm_revisions',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 14. Inventory Management ──────────────────────────────────────────────
  {
    id: 'inventory', name: 'Inventory Management',
    description: 'Products, categories, warehouses, stock, suppliers, and purchase orders.',
    tableCount: 7, edgeCount: 6,
    color: 'bg-lime-700',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"/></svg>,
    nodes: [
      { id:'iv_categories',  type:'tableNode', position:{x:80,  y:80},  data:{name:'categories',          columns:[pkCol('ivcat1'),fkNullCol('ivcat2','parent_id'),col('ivcat3','name','VARCHAR')]}},
      { id:'iv_suppliers',   type:'tableNode', position:{x:460, y:80},  data:{name:'suppliers',           columns:[pkCol('ivs1'),col('ivs2','name','VARCHAR'),col('ivs3','email','VARCHAR',{unique:true}),col('ivs4','phone','VARCHAR'),col('ivs5','address','TEXT',{nullable:true})],methods:[{id:'m_ivs_1',visibility:'+',name:'placeOrder'},{id:'m_ivs_2',visibility:'+',name:'getHistory'}]}},
      { id:'iv_warehouses',  type:'tableNode', position:{x:840, y:80},  data:{name:'warehouses',          columns:[pkCol('ivw1'),col('ivw2','name','VARCHAR'),col('ivw3','location','VARCHAR'),col('ivw4','capacity','INT')],methods:[{id:'m_ivw_1',visibility:'+',name:'addStock'},{id:'m_ivw_2',visibility:'+',name:'removeStock'}]}},
      { id:'iv_products',    type:'tableNode', position:{x:80,  y:360}, data:{name:'products',            columns:[pkCol('ivp1'),fkCol('ivp2','category_id'),col('ivp3','name','VARCHAR'),col('ivp4','sku','VARCHAR',{unique:true}),col('ivp5','unit','VARCHAR'),col('ivp6','reorder_level','INT')],methods:[{id:'m_ivp_1',visibility:'+',name:'updateStock'},{id:'m_ivp_2',visibility:'+',name:'reorder'},{id:'m_ivp_3',visibility:'+',name:'getStockLevel'}]}},
      { id:'iv_stock',       type:'tableNode', position:{x:840, y:360}, data:{name:'stock',               columns:[pkCol('ivst1'),fkCol('ivst2','product_id'),fkCol('ivst3','warehouse_id'),col('ivst4','quantity','INT')]}},
      { id:'iv_po',          type:'tableNode', position:{x:460, y:360}, data:{name:'purchase_orders',     columns:[pkCol('ivpo1'),fkCol('ivpo2','supplier_id'),col('ivpo3','status','ENUM',{default:'pending'}),col('ivpo4','ordered_at','DATE'),col('ivpo5','total_amount','DECIMAL')]}},
      { id:'iv_po_items',    type:'tableNode', position:{x:460, y:640}, data:{name:'purchase_order_items',columns:[pkCol('ivpoi1'),fkCol('ivpoi2','purchase_order_id'),fkCol('ivpoi3','product_id'),col('ivpoi4','quantity','INT'),col('ivpoi5','unit_price','DECIMAL')]}},
    ],
    edges: [
      {id:'ive1',source:'iv_categories', target:'iv_products', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ive2',source:'iv_warehouses', target:'iv_stock',    type:'smoothstep',data:{type:'1:N',sourceLabel:'stores',targetLabel:''}},
      {id:'ive3',source:'iv_products',   target:'iv_stock',    type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ive4',source:'iv_suppliers',  target:'iv_po',       type:'smoothstep',data:{type:'1:N',sourceLabel:'fulfills',targetLabel:''}},
      {id:'ive5',source:'iv_po',         target:'iv_po_items', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ive6',source:'iv_products',   target:'iv_po_items', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },

  // ── 15. Multi-tenant SaaS ─────────────────────────────────────────────────
  {
    id: 'multitenant', name: 'Multi-tenant SaaS',
    description: 'Tenants, users, plans, subscriptions, invoices, invoice items, features, and tenant features.',
    tableCount: 8, edgeCount: 7,
    color: 'bg-sky-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
    nodes: [
      { id:'mt_tenants',         type:'tableNode', position:{x:80,  y:80},  data:{name:'tenants',         columns:[pkCol('mtt1'),col('mtt2','name','VARCHAR'),col('mtt3','domain','VARCHAR',{unique:true}),col('mtt4','status','ENUM',{default:'active'})],methods:[{id:'m_mtt_1',visibility:'+',name:'activate'},{id:'m_mtt_2',visibility:'+',name:'suspend'},{id:'m_mtt_3',visibility:'+',name:'getUsage'}]}},
      { id:'mt_plans',           type:'tableNode', position:{x:840, y:80},  data:{name:'plans',           columns:[pkCol('mtp1'),col('mtp2','name','VARCHAR'),col('mtp3','price_monthly','DECIMAL'),col('mtp4','price_yearly','DECIMAL',{nullable:true}),col('mtp5','max_users','INT',{nullable:true})]}},
      { id:'mt_users',           type:'tableNode', position:{x:80,  y:360}, data:{name:'users',           columns:[pkCol('mtu1'),fkCol('mtu2','tenant_id'),col('mtu3','name','VARCHAR'),col('mtu4','email','VARCHAR',{unique:true}),col('mtu5','password','VARCHAR'),col('mtu6','role','ENUM',{default:'member'}),col('mtu7','is_active','BOOLEAN',{default:'1'})],methods:[{id:'m_mtu_1',visibility:'+',name:'login'},{id:'m_mtu_2',visibility:'+',name:'logout'},{id:'m_mtu_3',visibility:'+',name:'switchTenant'}]}},
      { id:'mt_subscriptions',   type:'tableNode', position:{x:460, y:80},  data:{name:'subscriptions',   columns:[pkCol('mts1'),fkCol('mts2','tenant_id'),fkCol('mts3','plan_id'),col('mts4','status','ENUM',{default:'active'}),col('mts5','starts_at','DATE'),col('mts6','ends_at','DATE',{nullable:true})],methods:[{id:'m_mts_1',visibility:'+',name:'activate'},{id:'m_mts_2',visibility:'+',name:'cancel'},{id:'m_mts_3',visibility:'+',name:'upgrade'}]}},
      { id:'mt_invoices',        type:'tableNode', position:{x:460, y:360}, data:{name:'invoices',        columns:[pkCol('mti1'),fkCol('mti2','subscription_id'),col('mti3','amount','DECIMAL'),col('mti4','status','ENUM',{default:'unpaid'}),col('mti5','issued_at','DATE'),col('mti6','paid_at','DATE',{nullable:true})]}},
      { id:'mt_invoice_items',   type:'tableNode', position:{x:840, y:360}, data:{name:'invoice_items',   columns:[pkCol('mtii1'),fkCol('mtii2','invoice_id'),col('mtii3','description','VARCHAR'),col('mtii4','amount','DECIMAL'),col('mtii5','quantity','INT')]}},
      { id:'mt_features',        type:'tableNode', position:{x:840, y:640}, data:{name:'features',        columns:[pkCol('mtf1'),col('mtf2','name','VARCHAR',{unique:true}),col('mtf3','description','TEXT',{nullable:true})]}},
      { id:'mt_tenant_features', type:'tableNode', position:{x:460, y:640}, data:{name:'tenant_features', columns:[pkCol('mttf1'),fkCol('mttf2','tenant_id'),fkCol('mttf3','feature_id'),col('mttf4','enabled','BOOLEAN',{default:'1'})]}},
    ],
    edges: [
      {id:'mte1',source:'mt_tenants',       target:'mt_users',           type:'smoothstep',data:{type:'1:N',sourceLabel:'has',targetLabel:''}},
      {id:'mte2',source:'mt_tenants',       target:'mt_subscriptions',   type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'mte3',source:'mt_plans',         target:'mt_subscriptions',   type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'mte4',source:'mt_subscriptions', target:'mt_invoices',        type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'mte5',source:'mt_invoices',      target:'mt_invoice_items',   type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'mte6',source:'mt_tenants',       target:'mt_tenant_features', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'mte7',source:'mt_features',      target:'mt_tenant_features', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },
]
