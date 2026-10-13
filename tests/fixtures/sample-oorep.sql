-- Synthetic OOREP-format dump for tests. Not real repertory data.
COPY public.info (abbrev, title, languag, authorlastname, authorfirstname, yearr, publisher, license, edition, access, displaytitle) FROM stdin;
testrep	Test Repertory	en	Tester	T.	2000	Nobody	Test data	\N	Public	Test Repertory
\.

COPY public.remedy (id, nameabbrev, namelong, namealt) FROM stdin;
1	Alph.	Alpha Testplant	\N
2	Bet.	Beta Testmineral	\N
3	Gam.	Gamma Unused	\N
4	O'Rem.	Quote\tTab Remedy	\N
\.

COPY public.rubric (abbrev, id, mother, ismother, chapterid, fullpath, path, textt) FROM stdin;
testrep	10	\N	\N	1	Mind	\N	\N
testrep	11	\N	\N	1	Mind, anxiety	\N	\N
testrep	12	\N	\N	1	Mind, anxiety, night	\N	\N
testrep	13	\N	\N	1	Head, pain, burning	\N	\N
testrep	14	\N	\N	1	Sleep, restless	\N	\N
testrep	15	\N	\N	1	2008	\N	\N
other	11	\N	\N	1	Mind, other repertory	\N	\N
\.

COPY public.rubricremedy (abbrev, rubricid, remedyid, weight, chapterid) FROM stdin;
testrep	11	1	3	1
testrep	11	2	1	1
testrep	12	1	2	1
testrep	13	2	3	1
testrep	13	4	1	1
testrep	14	1	1	1
testrep	14	2	2	1
testrep	14	99	2	1
testrep	15	1	1	1
other	11	3	3	1
\.
